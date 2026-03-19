# CryptoPulse 📈

> A real-time crypto market dashboard that turns raw tick data into clean, readable signals — so you can make faster decisions without staring at charts all day.

**Live Demo:** [crytopulse-saharshkoli14s-projects.vercel.app]([https://crytopulse-saharshkoli14s-projects.vercel.app](https://crytopulse-9naymykwl-saharshkoli14s-projects.vercel.app/))

---

## Table of Contents

- [What is CryptoPulse?](#what-is-cryptopulse)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Screenshots](#screenshots)
- [Getting Started (Local Setup)](#getting-started-local-setup)
- [Environment Variables](#environment-variables)
- [Deploying to Vercel](#deploying-to-vercel)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Future Scope](#future-scope)
- [Author](#author)

---

## What is CryptoPulse?

CryptoPulse is a full-stack data product that ingests real-time cryptocurrency tick data, stores it in a PostgreSQL database (Supabase), and serves it through a Next.js dashboard with ML-powered price movement predictions.

It is designed for **everyday crypto traders and brokers** who want signal clarity without the noise of traditional charting tools.

---

## Features

- **Live Market Overview** — Latest price, 24h change, volume, and volatility for BTC, ETH, and SOL
- **Symbol Detail View** — Per-coin OHLCV charts and historical price data
- **ML Prediction Engine** — Direction and strong-move signals with confidence levels
- **Plain Language Explanations** — Non-technical users see simple Up/Down/No Signal results
- **Technical Details Toggle** — Advanced users can inspect model metrics and thresholds
- **Market Index Chart** — Normalized multi-coin index (base = 100) over 24h
- **Volume Bar Chart** — Aggregate market volume per minute over 24h
- **Responsive Dark UI** — Clean glassmorphism design, works on desktop and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Recharts |
| Backend API | Next.js API Routes (serverless) |
| Database | PostgreSQL via Supabase |
| ML / Predictions | Python, scikit-learn (trained offline) |
| Data Ingestion | Python scripts (Coinbase WebSocket feed) |
| Deployment | Vercel (frontend + API), Supabase (DB) |
| Styling | Custom CSS with glassmorphism variables |

---

## Project Structure

```
crytopulse/
├── api/                        # Flask API (legacy / local dev)
│   └── app/
│       └── app.py              # Price endpoints (/prices/latest, /prices/history, /ohlcv/1m)
├── cryptopulse-dashboard/      # Main Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Home page (live overview cards)
│   │   │   ├── overview/       # Full overview page with charts
│   │   │   ├── prediction/     # ML prediction interface
│   │   │   ├── symbol/[symbol] # Per-coin detail page
│   │   │   ├── about/          # About page
│   │   │   └── api/
│   │   │       ├── overview/route.ts     # Overview data API
│   │   │       ├── health/route.ts       # Health check
│   │   │       └── predict/[symbol]/     # ML prediction API
│   │   ├── lib/
│   │   │   └── getOverview.ts  # Shared DB query function
│   │   └── components/
│   │       └── OverviewCharts.tsx        # Recharts market index + volume
│   ├── .env.local              # Local environment variables
│   └── package.json
├── ml/                         # Machine learning models and training scripts
├── ingest/                     # Data ingestion scripts (Coinbase WebSocket)
├── sql/                        # Database schema and migration scripts
└── docs/                       # Documentation
```

---

## How It Works

### Data Pipeline

```
Coinbase WebSocket Feed
        ↓
  Python Ingest Script (ingest/)
        ↓
  PostgreSQL / Supabase
  (public.ticks + public.ohlcv_1m)
        ↓
  Next.js API Routes
        ↓
  React Dashboard
```

1. **Ingest** — Python scripts connect to the Coinbase WebSocket feed and write raw ticks to `public.ticks` and 1-minute OHLCV candles to `public.ohlcv_1m`
2. **API** — Next.js serverless API routes query Supabase directly using `pg` connection pooling
3. **ML** — A Python model trained on historical OHLCV features generates direction and strong-move signals, served via `/api/predict/[symbol]`
4. **Frontend** — React Server Components fetch data at request time (`force-dynamic`) and render the dashboard

### Prediction Types

| Type | Description |
|---|---|
| Direction | Predicts whether price is likely to go Up or Down over the time window |
| Strong Move | Detects if a strong upward move (≥ threshold %) is likely within the window |

---

## Outline

| Home Page | Prediction Page |
|---|---|
| Live price cards for BTC, ETH, SOL | ML signal with confidence and plain explanation |

| Overview Page | About Page |
|---|---|
| Market index chart + volume bars | Feature summary and creator info |

---

## Getting Started (Local Setup)

### Prerequisites

- Node.js 18+
- Python 3.10+
- A PostgreSQL database (Supabase recommended)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/saharshkoli14/crytopulse.git
cd crytopulse
```

### 2. Set up the dashboard

```bash
cd cryptopulse-dashboard
npm install
```

### 3. Configure environment variables

Create a `.env.local` file inside `cryptopulse-dashboard/`:

```env
DATABASE_URL=postgresql://user:password@host:5432/postgres
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

See [Environment Variables](#environment-variables) for the full list.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. (Optional) Run the data ingestion

```bash
cd ../ingest
pip install -r requirements.txt
python ingest.py
```

### 6. (Optional) Set up the Flask API

```bash
cd ../api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app/app.py
```

---

## Environment Variables

Set these in `cryptopulse-dashboard/.env.local` for local dev, and in Vercel → Settings → Environment Variables for production.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://user:pass@host:5432/postgres` |
| `NEXT_PUBLIC_BASE_URL` | Your deployed base URL | `https://crytopulse-saharshkoli14s-projects.vercel.app` |
| `PGHOST` | DB host (optional, if not using DATABASE_URL) | `aws-0-us-west-2.pooler.supabase.com` |
| `PGPORT` | DB port | `5432` |
| `PGDATABASE` | DB name | `postgres` |
| `PGUSER` | DB user | `postgres.xxxx` |
| `PGPASSWORD` | DB password | `your_password` |

---

## Deploying to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Set **Root Directory** to `cryptopulse-dashboard`
4. Add all environment variables listed above
5. Deploy

> **Important:** Set `NEXT_PUBLIC_BASE_URL` to your Vercel production URL (e.g. `https://crytopulse-saharshkoli14s-projects.vercel.app`) — not a preview URL. Preview URLs are protected by Vercel authentication by default.

---

## API Reference

### `GET /api/overview`

Returns latest price stats and market index series for all tracked symbols.

**Response:**
```json
{
  "updated_at": "2026-03-19T17:38:22.513Z",
  "symbols": [
    {
      "symbol": "BTCUSD",
      "latest_bucket": "...",
      "latest_close": 69164.04,
      "close_24h_ago": 71706.44,
      "pct_change_24h": -0.035,
      "volume_24h": 8519.39,
      "price_std_24h": 739.21
    }
  ],
  "aggregate": {
    "symbol_count": 3,
    "advancers": 0,
    "decliners": 3,
    "total_volume_24h": 1505930.41
  },
  "series": [
    { "bucket": "...", "market_index": 99.77, "total_volume": 4451.73 }
  ]
}
```

### `GET /api/predict/[symbol]?mode=D&horizon=60&thr=0.0035`

Returns ML prediction signal for a given symbol.

| Param | Description | Example |
|---|---|---|
| `symbol` | Coin pair | `BTCUSD` |
| `mode` | `D` = Direction, `S` = Strong move | `D` |
| `horizon` | Time window in minutes | `60` |
| `thr` | Signal threshold (Strong move only) | `0.0035` |

### `GET /api/health`

Health check endpoint. Returns `{ "status": "ok" }`.

---

## Database Schema

### `public.ticks`

Raw trade ticks from the exchange feed.

| Column | Type | Description |
|---|---|---|
| `symbol` | text | e.g. BTCUSD |
| `event_time` | timestamptz | Tick timestamp |
| `price` | numeric | Trade price |
| `volume` | numeric | Trade volume |
| `source` | text | Exchange source |

### `public.ohlcv_1m`

1-minute OHLCV candles aggregated from ticks.

| Column | Type | Description |
|---|---|---|
| `symbol` | text | e.g. BTCUSD |
| `bucket` | timestamptz | Candle open time |
| `open` | numeric | Open price |
| `high` | numeric | High price |
| `low` | numeric | Low price |
| `close` | numeric | Close price |
| `volume` | numeric | Total volume |

---

## Future Scope

- **WebSocket live updates** — Replace polling with real-time price streaming to the frontend
- **Sparkline mini-charts** — Add inline price charts to each coin card on the overview
- **Price alerts** — Allow users to set threshold alerts with browser notifications
- **More coins** — Expand beyond BTC, ETH, SOL to top 20 by market cap
- **Model accuracy tracking** — Add a `/predictions/accuracy` endpoint to show historical signal performance
- **Confidence intervals** — Show prediction uncertainty bands, not just point estimates
- **Redis caching** — Cache the overview API response to reduce DB load on high traffic
- **TimescaleDB hypertables** — Migrate `ohlcv_1m` to TimescaleDB for faster time-series queries
- **Mobile app** — React Native version using the same API
- **Portfolio tracker** — Let users track their holdings alongside market signals
- **Dark/light mode toggle** — User preference stored in localStorage

---

## Author

**Saharsh Koli**

I build data-driven products using Python, SQL, analytics, and machine learning. CryptoPulse is one of my projects focused on making information easier to use in real decision-making.

- GitHub: [@saharshkoli14](https://github.com/saharshkoli14)
- Live project: [crytopulse-saharshkoli14s-projects.vercel.app](https://crytopulse-saharshkoli14s-projects.vercel.app)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

> CryptoPulse is designed to support decisions — not guarantee outcomes. Always combine signals with your own risk management.
