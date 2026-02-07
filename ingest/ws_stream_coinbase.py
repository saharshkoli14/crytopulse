import os
import time
from datetime import datetime, timedelta, timezone

import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "1"))

# Coinbase Exchange candle endpoint
BASE = "https://api.exchange.coinbase.com"

# Use Coinbase product ids
PRODUCTS = [
    ("BTC-USD", "BTCUSD"),
    ("ETH-USD", "ETHUSD"),
    ("SOL-USD", "SOLUSD"),
]

GRANULARITY = 60  # 1 minute candles
MAX_CANDLES = 300  # Coinbase limit per request (typically 300)


def iso_z(dt: datetime) -> str:
    """UTC ISO8601 without microseconds, with Z suffix."""
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def fetch_candles(product_id: str, start_dt: datetime, end_dt: datetime, granularity: int = 60):
    """
    Returns list of candles: [ [time, low, high, open, close, volume], ... ]
    Coinbase returns newest-first typically.
    """
    # Ensure end > start (Coinbase will 400 sometimes if equal)
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(minutes=1)

    url = f"{BASE}/products/{product_id}/candles"
    params = {
        "start": iso_z(start_dt),
        "end": iso_z(end_dt),
        "granularity": granularity,
    }

    r = requests.get(url, params=params, timeout=20)
    if r.status_code != 200:
        print("Coinbase error:", r.status_code, r.text)
        r.raise_for_status()

    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected response: {data}")

    # Data format: [time, low, high, open, close, volume]
    return data


def upsert_ticks(conn, rows):
    """
    Insert into ticks(symbol, event_time, price, volume)
    We use ON CONFLICT DO NOTHING assuming you have a unique constraint
    like (symbol, event_time, source) or similar.

    If your table has a 'source' column, add it below.
    """
    sql = """
        INSERT INTO public.ticks (symbol, event_time, price, volume, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """
    execute_values(conn.cursor(), sql, rows, page_size=1000)
    conn.commit()


def backfill_product(conn, product_id: str, symbol: str, days: int, granularity: int = 60):
    """
    Backfill last N days of 1m candles by paging in <= MAX_CANDLES windows.
    """
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start_all = now - timedelta(days=days)

    # Each candle is 1 minute -> MAX_CANDLES minutes per request
    chunk_minutes = MAX_CANDLES  # 300 minutes = 5 hours
    step = timedelta(minutes=chunk_minutes)

    t = start_all
    inserted_total = 0

    while t < now:
        t2 = min(t + step, now)

        candles = fetch_candles(product_id, t, t2, granularity=granularity)

        # Coinbase returns newest-first; sort oldest-first for clean inserts
        candles.sort(key=lambda c: c[0])

        rows = []
        for c in candles:
            # c = [time, low, high, open, close, volume]
            ts = datetime.fromtimestamp(c[0], tz=timezone.utc)
            close_price = float(c[4])
            vol = float(c[5])

            rows.append((symbol, ts, close_price, vol, "coinbase"))

        if rows:
            upsert_ticks(conn, rows)
            inserted_total += len(rows)
            print(f"✅ {symbol} inserted {len(rows)} ticks [{iso_z(t)} -> {iso_z(t2)}]")

        # gentle rate-limit
        time.sleep(0.25)
        t = t2

    print(f"✅ DONE {symbol}: approx inserted rows = {inserted_total}")


def main():
    with psycopg2.connect(DB_URL) as conn:
        for product_id, symbol in PRODUCTS:
            backfill_product(conn, product_id, symbol, days=BACKFILL_DAYS, granularity=GRANULARITY)


if __name__ == "__main__":
    main()
