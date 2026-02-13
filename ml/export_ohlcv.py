import os
import pandas as pd
import psycopg2

# Usage:
#   set DATABASE_URL env var (same as your Next app)
#   python ml/export_ohlcv.py BTCUSD
#
# Output:
#   ml/data/BTCUSD_ohlcv_1m.parquet

def export_symbol(symbol: str, out_path: str, lookback_days: int = 14):
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL env var not set")

    conn = psycopg2.connect(db_url)

    # Pull last N days of 1m candles for one symbol
    q = """
        SELECT
          bucket,
          open,
          high,
          low,
          close,
          volume
        FROM public.ohlcv_1m
        WHERE symbol = %s
          AND bucket >= now() - (%s || ' days')::interval
        ORDER BY bucket ASC;
    """

    df = pd.read_sql(q, conn, params=(symbol, lookback_days))
    conn.close()

    if df.empty:
        raise RuntimeError(f"No rows found for symbol={symbol} in public.ohlcv_1m")

    # Make sure types are clean
    df["bucket"] = pd.to_datetime(df["bucket"], utc=True)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Drop any bad rows
    df = df.dropna(subset=["close"])

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_parquet(out_path, index=False)
    print(f"Saved {len(df)} rows -> {out_path}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ml/export_ohlcv.py <SYMBOL> [DAYS]")
        raise SystemExit(1)

    symbol = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) >= 3 else 14

    out = f"ml/data/{symbol}_ohlcv_1m.parquet"
    export_symbol(symbol, out, lookback_days=days)
