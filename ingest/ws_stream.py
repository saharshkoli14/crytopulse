import os
import json
import time
from datetime import datetime, timezone

import psycopg2
import websocket
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]

SYMBOLS = ["btcusdt", "ethusdt", "solusdt"]
STREAM_URL = (
    "wss://stream.binance.com:9443/stream?streams="
    + "/".join(f"{s}@miniTicker" for s in SYMBOLS)
)

INSERT_SQL = """
insert into public.ticks (symbol, event_time, price, volume)
values (%s, %s, %s, %s)
on conflict do nothing;
"""

def on_message(ws, message):
    data = json.loads(message)["data"]
    symbol = data["s"]
    price = float(data["c"])
    volume = float(data["v"])
    event_time = datetime.fromtimestamp(data["E"] / 1000, tz=timezone.utc)

    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    INSERT_SQL,
                    (symbol, event_time, price, volume),
                )
            conn.commit()
        print(f"📈 {symbol} {price}")
    except Exception as e:
        print("DB error:", e)

def on_error(ws, error):
    print("WebSocket error:", error)

def on_close(ws, *_):
    print("WebSocket closed. Reconnecting in 5s...")
    time.sleep(5)
    start()

def start():
    ws = websocket.WebSocketApp(
        STREAM_URL,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )
    ws.run_forever(ping_interval=20, ping_timeout=10)

if __name__ == "__main__":
    print("🚀 Starting crypto stream...")
    start()
