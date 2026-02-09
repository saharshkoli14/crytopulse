import os
import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

# ---------------- CONFIG ---------------- #

COINBASE_BASE = "https://api.exchange.coinbase.com"
MAX_CANDLES_PER_REQUEST = 300

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": os.getenv("PGPORT", "5432"),
    "dbname": os.getenv("PGDATABASE", "postgres"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", ""),
}

# ---------------- HELPERS ---------------- #

def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def chunk_range(
    start: datetime,
    end: datetime,
    granularity: int,
) -> List[Tuple[datetime, datetime]]:
    max_window = timedelta(seconds=granularity * MAX_CANDLES_PER_REQUEST)
    chunks = []
    t = start
    while t < end:
        t2 = min(t + max_window, end)
        chunks.append((t, t2))
        t = t2
    return chunks

# ---------------- COINBASE ---------------- #

def fetch_candles(
    product_id: str,
    start: datetime,
    end: datetime,
    granularity: int,
):
    url = f"{COINBASE_BASE}/products/{product_id}/candles"
    params = {
        "start": iso_z(start),
        "end": iso_z(end),
        "granularity": granularity,
    }
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

# ---------------- DATABASE ---------------- #

def insert_ticks(conn, rows):
    if not rows:
        return 0

    sql = """
    INSERT INTO public.ticks (event_time, symbol, price, volume, source)
    VALUES %s
    ON CONFLICT (symbol, event_time, price) DO NOTHING;
    """

    with conn.cursor() as cur:
        execute_values(
            cur,
            sql,
            [(t, s, p, v, "coinbase") for (t, s, p, v) in rows],
            page_size=1000,
        )
    conn.commit()
    return len(rows)

# ---------------- BACKFILL ---------------- #

def backfill_product(
    conn,
    symbol: str,
    product_id: str,
    start: datetime,
    end: datetime,
    granularity: int,
):
    print(f"Backfilling {symbol} ({product_id}) @ {granularity}s")
    chunks = chunk_range(start, end, granularity)
    print(f"Total chunks: {len(chunks)} (max {MAX_CANDLES_PER_REQUEST} candles per chunk)")

    total_inserted = 0

    for i, (t1, t2) in enumerate(chunks, 1):
        candles = fetch_candles(product_id, t1, t2, granularity)

        rows = []
        for c in candles:
            ts = datetime.fromtimestamp(c[0], tz=timezone.utc)
            price = float(c[4])      # close
            volume = float(c[5])
            rows.append((ts, symbol, price, volume))

        inserted = insert_ticks(conn, rows)
        total_inserted += inserted

        print(
            f"Chunk {i}/{len(chunks)} {iso_z(t1)} → {iso_z(t2)} | "
            f"candles={len(rows)} | inserted={inserted}"
        )

        time.sleep(0.35)  # Coinbase rate safety

    print(f"Done {symbol}: total_inserted={total_inserted}")

# ---------------- MAIN ---------------- #

def main():
    for symbol in symbols:
    backfill_product(conn, symbol.strip(), ...)
    granularity = int(os.getenv("GRANULARITY", "60"))
    days = int(os.getenv("BACKFILL_DAYS", "1"))

    product_id = f"{symbol[:-3]}-{symbol[-3:]}"  # BTCUSD -> BTC-USD

    now = datetime.now(timezone.utc)

    start_env = os.getenv("START")
    end_env = os.getenv("END")

    if start_env and end_env:
        start = datetime.fromisoformat(start_env.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_env.replace("Z", "+00:00"))
    else:
        end = now
        start = now - timedelta(days=days)

    print(
        f"Backfilling {symbol} ({product_id}) for "
        f"{(end - start).days} day(s) @ {granularity}s candles"
    )

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        backfill_product(conn, symbol, product_id, start, end, granularity)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
