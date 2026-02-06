import os
from datetime import datetime, timezone

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.environ["DATABASE_URL"]

def get_btc_price() -> float:
    r = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": "bitcoin", "vs_currencies": "usd"},
        timeout=10,
    )
    r.raise_for_status()
    return float(r.json()["bitcoin"]["usd"])

def main():
    price = get_btc_price()
    event_time = datetime.now(timezone.utc)

    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.ticks (symbol, event_time, price, volume)
                values (%s, %s, %s, %s)
                on conflict do nothing;
                """,
                ("BTCUSDT", event_time, price, None),
            )
        conn.commit()

    print("✅ Inserted 1 tick:", "BTCUSDT", event_time.isoformat(), price)

if __name__ == "__main__":
    main()
