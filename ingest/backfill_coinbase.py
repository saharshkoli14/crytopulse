import os
import time
from datetime import datetime, timezone, timedelta

import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]

# Coinbase Pro style endpoint still works via api.exchange.coinbase.com
BASE = "https://api.exchange.coinbase.com"


def iso(dt: datetime) -> str:
    # Coinbase expects ISO8601
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_candles(product_id: str, start: datetime, end: datetime, granularity: int = 60):
    """
    Returns list of candles: [ time, low, high, open, close, volume ]
    Coinbase returns newest-first.
    """
    url = f"{BASE}/products/{product_id}/candles"
    params = {
        "start": iso(start),
        "end": iso(end),
        "granularity": granularity,
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def insert_ticks(conn, symbol: str, candle_rows):
    """
    We store one synthetic tick per minute using the candle close as 'price'.
    event_time = candle timestamp (UTC)
    """
    sql = """
    insert into public.ticks (symbol, event_time, price, volume)
    values (%s, %s, %s, %s)
    on conflict do nothing;
    """
    with conn.cursor() as cur:
        for c in candle_rows:
            # c = [time, low, high, open, close, volume]
            ts = datetime.fromtimestamp(c[0], tz=timezone.utc)
            price = float(c[4])   # close
            volume = float(c[5])
            cur.execute(sql, (symbol, ts, price, volume))
    conn.commit()


def backfill_product(conn, product_id: str, symbol: str, days: int = 7, granularity: int = 60):
    """
    Coinbase candle endpoint has limits; safest is chunking by 6 hours for 1-min candles.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    chunk = timedelta(hours=6)

    t = start
    while t < end:
        t2 = min(t + chunk, end)

        candles = fetch_candles(product_id, t, t2, granularity=granularity)
        if candles:
            # Coinbase returns newest-first; reverse to insert in chronological order
            candles = list(reversed(candles))
            insert_ticks(conn, symbol, candles)
            print(f"✅ {symbol}: inserted {len(candles)} candles from {t} to {t2}")
        else:
            print(f"⚠️ {symbol}: no data from {t} to {t2}")

        # Be nice to API
        time.sleep(0.35)
        t = t2


def main():
    # Map: coinbase product -> your symbol
    pairs = [
        ("BTC-USD", "BTCUSD"),
        ("ETH-USD", "ETHUSD"),
        ("SOL-USD", "SOLUSD"),
    ]

    days = int(os.getenv("BACKFILL_DAYS", "7"))

    with psycopg2.connect(DB_URL) as conn:
        for product_id, symbol in pairs:
            backfill_product(conn, product_id, symbol, days=days, granularity=60)

    print("🎉 Backfill complete.")


if __name__ == "__main__":
    main()
