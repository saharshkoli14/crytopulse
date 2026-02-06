import os
import json
import time
from datetime import datetime, timezone

import psycopg2
import websocket
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.environ["DATABASE_URL"]

# Coinbase product IDs (USD pairs)
PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"]

INSERT_SQL = """
insert into public.ticks (symbol, event_time, price, volume, source)
values (%s, %s, %s, %s, %s)
on conflict do nothing;
"""

WS_URL = "wss://ws-feed.exchange.coinbase.com"

def insert_tick(symbol: str, price: float, volume: float | None):
    event_time = datetime.now(timezone.utc)
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                INSERT_SQL,
                (symbol, event_time, price, volume, "coinbase"),
            )
        conn.commit()

def on_open(ws):
    sub = {
        "type": "subscribe",
        "product_ids": PRODUCTS,
        "channels": ["ticker"]
    }
    ws.send(json.dumps(sub))
    print("✅ Subscribed:", PRODUCTS)

def on_message(ws, message):
    msg = json.loads(message)

    if msg.get("type") != "ticker":
        return

    product = msg.get("product_id")          # e.g., BTC-USD
    price = float(msg.get("price"))
    volume = float(msg.get("last_size")) if msg.get("last_size") else None

    symbol = product.replace("-", "")        # BTCUSD (matches your table style)
    try:
        insert_tick(symbol, price, volume)
        print(f"📈 {symbol} {price}")
    except Exception as e:
        print("DB error:", repr(e))

def on_error(ws, error):
    print("WebSocket error:", repr(error))

def on_close(ws, *_):
    print("WebSocket closed. Reconnecting in 5s...")
    time.sleep(5)
    start()

def start():
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )
    ws.run_forever(ping_interval=20, ping_timeout=10)

if __name__ == "__main__":
    print("🚀 Starting Coinbase crypto stream...")
    start()
