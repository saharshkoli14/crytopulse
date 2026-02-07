import os
import time
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Dict, Any

import requests
from dotenv import load_dotenv

# Uses psycopg2 because it's the most common on Windows for this setup.
import psycopg2
from psycopg2.extras import execute_batch


BASE_URL = "https://api.exchange.coinbase.com"


# Map your internal symbols -> Coinbase product IDs
PRODUCTS: Dict[str, str] = {
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "SOLUSD": "SOL-USD",
}

# Coinbase candles granularity allowed values (seconds)
ALLOWED_GRANULARITIES = {60, 300, 900, 3600, 21600, 86400}

# Coinbase returns max 300 candles per request
MAX_CANDLES_PER_REQUEST = 300


def iso_z(dt: datetime) -> str:
    """
    Coinbase expects RFC3339 timestamps; keep it clean:
    - timezone aware UTC
    - no microseconds
    - Z suffix
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def fetch_candles(product_id: str, start: datetime, end: datetime, granularity: int) -> List[List[Any]]:
    """
    Returns list of candles: [ time, low, high, open, close, volume ]
    """
    url = f"{BASE_URL}/products/{product_id}/candles"
    params = {
        "start": iso_z(start),
        "end": iso_z(end),
        "granularity": granularity,
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()

    # Coinbase returns newest-first; reverse to insert chronologically
    data.sort(key=lambda x: x[0])
    return data


def insert_ticks(conn, rows: List[Tuple[str, datetime, float, float, str]]) -> int:
    """
    rows: (symbol, event_time, price, volume, source)
    """
    if not rows:
        return 0

    sql = """
    INSERT INTO public.ticks (symbol, event_time, price, volume, source)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING;
    """
    with conn.cursor() as cur:
        execute_batch(cur, sql, rows, page_size=500)
    conn.commit()
    return len(rows)


def backfill_product(conn, symbol: str, product_id: str, days: int, granularity: int = 60) -> None:
    if granularity not in ALLOWED_GRANULARITIES:
        raise ValueError(f"Invalid granularity={granularity}. Allowed: {sorted(ALLOWED_GRANULARITIES)}")

    # Define time range (UTC), aligned to the minute
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = end - timedelta(days=days)

    # Max window Coinbase allows per request
    max_window_seconds = granularity * MAX_CANDLES_PER_REQUEST
    source = "coinbase"

    total_inserted = 0
    t = start

    print(f"▶ Backfilling {symbol} ({product_id}) for last {days} day(s), granularity={granularity}s")

    while t < end:
        t2 = min(t + timedelta(seconds=max_window_seconds), end)

        try:
            candles = fetch_candles(product_id, t, t2, granularity)
        except requests.HTTPError as e:
            # Print useful debugging info and stop
            print(f"❌ Coinbase request failed for {symbol}: {e}")
            print(f"   start={iso_z(t)} end={iso_z(t2)} granularity={granularity}")
            raise

        rows = []
        for c in candles:
            # [ time, low, high, open, close, volume ]
            ts = int(c[0])
            close_price = float(c[4])
            vol = float(c[5])

            event_time = datetime.fromtimestamp(ts, tz=timezone.utc)
            rows.append((symbol, event_time, close_price, vol, source))

        inserted = insert_ticks(conn, rows)
        total_inserted += inserted

        print(f"  ✅ {symbol}: {iso_z(t)} → {iso_z(t2)} | candles={len(candles)} inserted={inserted}")

        # Move forward
        t = t2

        # Be polite to API
        time.sleep(0.15)

    print(f"✅ Done {symbol}. Total inserted (attempted): {total_inserted}\n")


def main() -> None:
    load_dotenv()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is missing. Put it in ingest/.env")

    days = int(os.environ.get("BACKFILL_DAYS", "1"))
    granularity = int(os.environ.get("GRANULARITY", "60"))

    with psycopg2.connect(db_url) as conn:
        for symbol, product_id in PRODUCTS.items():
            backfill_product(conn, symbol, product_id, days=days, granularity=granularity)


if __name__ == "__main__":
    main()
