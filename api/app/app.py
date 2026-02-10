import os
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]

app = Flask(__name__)

def fetch_all(query: str, params: tuple = ()):
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"})

@app.route("/prices/latest", methods=["GET"])
def latest_prices():
    symbols = request.args.get("symbols", "BTCUSD,ETHUSD,SOLUSD")
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    q = """
    select distinct on (symbol)
      symbol, event_time, price, volume, source
    from public.ticks
    where symbol = any(%s)
    order by symbol, event_time desc;
    """
    return jsonify({"data": fetch_all(q, (sym_list,))})

@app.route("/prices/history", methods=["GET"])
def price_history():
    symbol = request.args.get("symbol", "BTCUSD").upper()
    minutes = int(request.args.get("minutes", 60))
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    q = """
    select symbol, event_time, price, volume, source
    from public.ticks
    where symbol = %s and event_time >= %s
    order by event_time asc;
    """
    return jsonify({"data": fetch_all(q, (symbol, since))})

@app.route("/ohlcv/1m", methods=["GET"])
def ohlcv_1m():
    symbol = request.args.get("symbol", "BTCUSD").upper()
    minutes = int(request.args.get("minutes", 120))
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    q = """
    select symbol, bucket as time, open, high, low, close, volume
    from public.ohlcv_1m
    where symbol = %s and bucket >= %s
    order by bucket asc;
    """
    return jsonify({"data": fetch_all(q, (symbol, since))})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
