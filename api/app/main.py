import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, Query

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]

app = FastAPI(title="CryptoPulse API", version="0.1.0")


def fetch_all(query: str, params: tuple = ()):
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/prices/latest")
def latest_prices(symbols: str = Query("BTCUSD,ETHUSD,SOLUSD")):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    # distinct-on returns latest row per symbol
    q = """
    select distinct on (symbol)
      symbol, event_time, price, volume, source
    from public.ticks
    where symbol = any(%s)
    order by symbol, event_time desc;
    """
    return {"data": fetch_all(q, (sym_list,))}


@app.get("/prices/history")
def price_history(
    symbol: str = Query("BTCUSD"),
    minutes: int = Query(60, ge=1, le=24 * 60),
):
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    q = """
    select symbol, event_time, price, volume, source
    from public.ticks
    where symbol = %s and event_time >= %s
    order by event_time asc;
    """
    return {"data": fetch_all(q, (symbol.upper(), since))}


@app.get("/ohlcv/1m")
def ohlcv_1m(
    symbol: str = Query("BTCUSD"),
    minutes: int = Query(120, ge=1, le=7 * 24 * 60),
):
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    q = """
    select symbol, bucket as time, open, high, low, close, volume
    from public.ohlcv_1m
    where symbol = %s and bucket >= %s
    order by bucket asc;
    """
    return {"data": fetch_all(q, (symbol.upper(), since))}

