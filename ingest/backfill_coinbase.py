import os
import time
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Dict, Any, Optional

import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv


COINBASE_BASE = "https://api.exchange.coinbase.com"
USER_AGENT = "cryptopulse-backfill/1.0"

# Map of our symbol -> Coinbase product_id
PRODUCTS: Dict[str, str] = {
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "SOLUSD": "SOL-USD",
}

MAX_CANDLES_PER_REQUEST = 300  # Coinbase limit


def iso_z(dt: datetime) -> str:
    """UTC RFC3339 with Z, no microseconds."""
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def get_env_int(name: str, default: int) -> int:
    v = os.getenv(name)
    if not v:
        return default
    try:
        return int(v)
    except ValueError:
        return default


def fetch_candles(
    product_id: str,
    start: datetime,
    end: datetime,
    granularity: int,
    session: requests.Session,
) -> List[List[Any]]:
    """
    Returns list of candles:
      [ time, low, high, open, close, volume ]
    time is unix seconds.
    """
    url = f"{COINBASE_BASE}/products/{product_id}/candles"
    params = {
        "start": iso_z(start),
        "end": iso_z(end),
        "granularity": granularity,
    }
    headers = {"User-Agent": USER_AGENT}

    r = session.get(url, params=params, headers=headers, timeout=30)

    # Helpful debug if it fails
    if not r.ok:
        try:
            body = r.json()
        except Exception:
            body = r.text[:400]
        raise requests.HTTPError(
            f"{r.status_code} {r.reason} for {r.url} | body={body}",
            response=r,
        )

    data = r.json()
    # Coinbase returns newest first; normalize to oldest first
    data.sort(key=lambda x: x[0])
    return data


def chunk_range(start: datetime, end: datetime, granularity: int) -> List[Tuple[datetime, datetime]]:
    """
    Split [start, end] into chunks that respect Coinbase max candles limit.
    Window size = granularity * MAX_CANDLES_PER_REQUEST seconds.
    """
    max_window = timedelta(seconds=granularity * MAX_CANDLES_PER_REQUEST)

    chunks = []
    t = start
    while t < end:
        t2 = min(t + max_window, end)
        # Coinbase requires start < end
        if t2 <= t:
            break
        chunks.append((t, t2))
        t = t2
    return chunks


def insert_ticks(conn, rows: List[Tuple[datetime, str, float, float]]) -> int:
    """
    rows: (event_time, symbol, price, volume)
    Inserts into public.ticks with source='coinbase'
    """
    if not rows:
        return 0

    sql = """
        INSERT INTO public.ticks (event_time, symbol, price, volume, source)
        VALUES %s
    """

    # If you have a unique constraint like (source, symbol, event_time),
    # you can add: ON CONFLICT DO NOTHING
    # Keeping it plain here to avoid failing if constraint doesn't exist.

    with conn.cursor() as cur:
        execute_values(cur, sql, [(t, s, p, v, "coinbase") for (t, s, p, v) in rows])
    conn.commit()
    return len(rows)


def backfill_product(conn, symbol: str, product_id: str, days: int, granularity: int) -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    start = (now - timedelta(days=days)).replace(microsecond=0)

    chunks = chunk_range(start, now, granularity=granularity)

    print(f"Backfilling {symbol} ({product_id}) for {days} day(s) @ {granularity}s candles")
    print(f"Total chunks: {len(chunks)} (max {MAX_CANDLES_PER_REQUEST} candles per chunk)")

    sess = requests.Session()

    total_inserted = 0
    for i, (t1, t2) in enumerate(chunks, start=1):
        # retry with small backoff
        for attempt in range(5):
            try:
                candles = fetch_candles(product_id, t1, t2, granularity, session=sess)
                break
            except Exception as e:
                if attempt == 4:
                    raise
                sleep_s = 1.5 * (attempt + 1)
                print(f"  Chunk {i}/{len(chunks)} failed ({e}). Retrying in {sleep_s:.1f}s...")
                time.sleep(sleep_s)

        # Convert candles -> ticks using close price at candle timestamp
        rows = []
        for c in candles:
            # [ time, low, high, open, close, volume ]
            ts = datetime.fromtimestamp(c[0], tz=timezone.utc).replace(microsecond=0)
            close = float(c[4])
            vol = float(c[5])
            rows.append((ts, symbol, close, vol))

        inserted = insert_ticks(conn, rows)
        total_inserted += inserted

        print(
            f"  Chunk {i}/{len(chunks)} {iso_z(t1)} → {iso_z(t2)} | candles={len(candles)} | inserted={inserted}"
        )

        # Be nice to the API
        time.sleep(0.2)

    print(f"Done {symbol}: total_inserted={total_inserted}")


def main():
    load_dotenv()

    days = get_env_int("BACKFILL_DAYS", 1)
    granularity = get_env_int("GRANULARITY", 60)

    db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")
    if not db_url:
        raise RuntimeError("Missing DATABASE_URL (or DB_URL) in environment/.env")

    # Coinbase granularity allowed: 60, 300, 900, 3600, 21600, 86400
    allowed = {60, 300, 900, 3600, 21600, 86400}
    if granularity not in allowed:
        raise ValueError(f"GRANULARITY must be one of {sorted(allowed)}. Got {granularity}")

    with psycopg2.connect(db_url) as conn:
        for symbol, product_id in PRODUCTS.items():
            backfill_product(conn, symbol, product_id, days=days, granularity=granularity)


if __name__ == "__main__":
    main()
