import os
import time
from datetime import datetime, timedelta, timezone

import requests
import psycopg2
from dotenv import load_dotenv

# Coinbase Exchange (Advanced Trade / Exchange candles endpoint)
BASE = "https://api.exchange.coinbase.com"

# Products we backfill (Coinbase product_id -> our symbol)
PRODUCTS = [
    ("BTC-USD", "BTCUSD"),
    ("ETH-USD", "ETHUSD"),
    ("SOL-USD", "SOLUSD"),
]

# ---- Helpers ----
def iso_z(dt: datetime) -> str:
    """
    Coinbase candles endpoint is picky: use UTC, seconds precision only (no microseconds),
    and a Z suffix.
    """
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_candles(product_id: str, start_dt: datetime, end_dt: datetime, granularity: int = 60):
    """
    Fetch candles from Coinbase Exchange:
    Returns list of [time, low, high, open, close, volume]
    """
    # Coinbase can 400 if end <= start
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(seconds=granularity)

    url = f"{BASE}/products/{product_id}/candles"
    params = {
        "start": iso_z(start_dt),
        "end": iso_z(end_dt),
        "granularity": granularity,
    }
    headers = {"Accept": "application/json", "User-Agent": "cryptopulse/1.0"}

    r = requests.get(url, params=params, headers=headers, timeout=20)

    # Debug on failure
    if r.status_code != 200:
        print("DEBUG product:", product_id)
        print("DEBUG params:", params)
        print("Coinbase error:", r.status_code, r.text)
        r.raise_for_status()

    return r.json()


def upsert_ticks(conn, symbol: str, candles):
    """
    Insert candles into public.ticks.

    Assumes public.ticks has:
      symbol TEXT
      event_time TIMESTAMPTZ
      price NUMERIC/DOUBLE
      volume NUMERIC/DOUBLE NULLABLE
      source TEXT
    and a UNIQUE constraint like (symbol, event_time, source) or similar.

    We'll insert "close" as price, and candle volume.
    """
    if not candles:
        return 0

    inserted = 0
    with conn.cursor() as cur:
        for row in candles:
            # Coinbase format: [time, low, high, open, close, volume]
            ts_epoch, low, high, opn, close, vol = row

            event_time = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).replace(microsecond=0)
            price = float(close) if close is not None else None
            volume = float(vol) if vol is not None else None

            cur.execute(
                """
                insert into public.ticks (symbol, event_time, price, volume, source)
                values (%s, %s, %s, %s, %s)
                on conflict do nothing;
                """,
                (symbol, event_time, price, volume, "coinbase"),
            )
            # rowcount is 1 when inserted, 0 when conflict
            inserted += cur.rowcount

    conn.commit()
    return inserted


def backfill_product(conn, product_id: str, symbol: str, days: int = 1, granularity: int = 60):
    """
    Backfill last N days in small windows.
    Coinbase returns max ~300 candles per call commonly; use 5 hours per request for 1m candles.
    5 hours = 300 minutes => 300 candles
    """
    now = datetime.now(timezone.utc).replace(microsecond=0)
    start = now - timedelta(days=days)

    window = timedelta(hours=5)  # 5 hours => ~300 candles at 1-minute granularity
    t = start

    total_inserted = 0
    while t < now:
        t2 = min(t + window, now)

        candles = fetch_candles(product_id, t, t2, granularity=granularity)

        # Coinbase returns newest-first; sort ascending by time
        candles_sorted = sorted(candles, key=lambda x: x[0]) if candles else []

        ins = upsert_ticks(conn, symbol, candles_sorted)
        total_inserted += ins

        print(f"✅ {symbol} {product_id} {iso_z(t)} -> {iso_z(t2)} | fetched={len(candles_sorted)} inserted={ins}")

        # Move forward
        t = t2

        # polite rate limiting
        time.sleep(0.25)

    return total_inserted


def main():
    load_dotenv()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found. Put it in ingest/.env")

    days = int(os.getenv("BACKFILL_DAYS", "1"))
    granularity = int(os.getenv("GRANULARITY", "60"))  # 60 seconds (1m)

    print(f"Starting Coinbase backfill: days={days}, granularity={granularity}s")

    conn = psycopg2.connect(db_url)
    try:
        grand_total = 0
        for product_id, symbol in PRODUCTS:
            grand_total += backfill_product(conn, product_id, symbol, days=days, granularity=granularity)

        print(f"\n🎉 Done. Total inserted: {grand_total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
