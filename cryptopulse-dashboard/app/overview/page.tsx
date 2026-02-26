import Link from "next/link";
import { Pool, type PoolClient } from "pg";
import OverviewCharts from "./OverviewCharts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

type SymbolRow = {
  symbol: string;
  latest_bucket: string;
  latest_close: string | number | null;
  close_24h_ago: string | number | null;
  pct_change_24h: string | number | null;
  volume_24h: string | number | null;
  price_std_24h: string | number | null;
};

type SeriesRow = {
  bucket: string;
  market_index: string | number | null;
  total_volume: string | number | null;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(x: number | null | undefined) {
  if (x === null || x === undefined) return "—";
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);
}

function fmtPct(x: number | null | undefined) {
  if (x === null || x === undefined) return "—";
  const v = x * 100;
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

export default async function OverviewPage() {
  let client: PoolClient | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      return (
        <main style={{ padding: 24, fontFamily: "system-ui" }}>
          <h1>CryptoPulse</h1>
          <p style={{ color: "crimson" }}>DATABASE_URL not configured</p>
        </main>
      );
    }

    client = await pool.connect();

    // ---- SYMBOL OVERVIEW QUERY ----
    const qSymbols = `
      WITH latest AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          bucket AS latest_bucket,
          close  AS latest_close
        FROM public.ohlcv_1m
        WHERE symbol <> 'BTCUSDT'   -- ✅ EXCLUDE HERE
        ORDER BY symbol, bucket DESC
      ),
      window_24h AS (
        SELECT
          symbol,
          (array_agg(close ORDER BY bucket ASC))[1]  AS close_24h_ago,
          SUM(volume) AS volume_24h,
          STDDEV_SAMP(close) AS price_std_24h
        FROM public.ohlcv_1m
        WHERE bucket >= now() - interval '24 hours'
          AND symbol <> 'BTCUSDT'   -- ✅ EXCLUDE HERE
        GROUP BY symbol
      )
      SELECT
        l.symbol,
        l.latest_bucket,
        l.latest_close,
        w.close_24h_ago,
        CASE
          WHEN w.close_24h_ago IS NULL OR w.close_24h_ago = 0 THEN NULL
          ELSE (l.latest_close - w.close_24h_ago) / w.close_24h_ago
        END AS pct_change_24h,
        w.volume_24h,
        w.price_std_24h
      FROM latest l
      LEFT JOIN window_24h w USING (symbol)
      ORDER BY l.symbol;
  `;

    const symbolRes = await client.query<SymbolRow>(qSymbols);

    const symbols = (symbolRes.rows ?? []).map((r) => ({
      symbol: r.symbol,
      latest_bucket: r.latest_bucket,
      latest_close: toNum(r.latest_close),
      close_24h_ago: toNum(r.close_24h_ago),
      pct_change_24h: toNum(r.pct_change_24h),
      volume_24h: toNum(r.volume_24h),
      price_std_24h: toNum(r.price_std_24h),
    }));

    // ---- MARKET INDEX SERIES ----
    const qSeries = `
      WITH w AS (
        SELECT
          symbol,
          bucket,
          close,
          volume,
          FIRST_VALUE(close) OVER (PARTITION BY symbol ORDER BY bucket ASC) AS first_close
        FROM public.ohlcv_1m
        WHERE bucket >= now() - interval '24 hours'
          AND symbol <> 'BTCUSDT'   -- ✅ EXCLUDE HERE
      )
      SELECT
        bucket,
        AVG((close / NULLIF(first_close, 0)) * 100.0) AS market_index,
        SUM(volume) AS total_volume
      FROM w
      GROUP BY bucket
      ORDER BY bucket ASC;
  `;

    const seriesRes = await client.query<SeriesRow>(qSeries);

    const series = (seriesRes.rows ?? []).map((r) => ({
      bucket: r.bucket,
      market_index: toNum(r.market_index),
      total_volume: toNum(r.total_volume),
    }));

    return (
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui" }}>
        <h1 style={{ marginBottom: 8 }}>CryptoPulse</h1>
        <p style={{ opacity: 0.7 }}>
          Overview of tracked crypto pairs • Updated {new Date().toLocaleString()}
        </p>

        {/* ---- TOP CARDS ---- */}
        <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
          {symbols.slice(0, 3).map((s) => (
            <div
              key={s.symbol}
              style={{
                border: "1px solid #333",
                borderRadius: 16,
                padding: 20,
                width: 320,
              }}
            >
              <h3 style={{ margin: 0 }}>{s.symbol}</h3>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
                {fmtNum(s.latest_close)}
              </div>
              <div style={{ marginTop: 8 }}>24h change: {fmtPct(s.pct_change_24h)}</div>
              <div>24h volume: {fmtNum(s.volume_24h)}</div>
              <div>24h stdev: {fmtNum(s.price_std_24h)}</div>

              <Link href={`/symbol/${encodeURIComponent(s.symbol)}`}>
                <button style={{ marginTop: 12 }}>View details →</button>
              </Link>
            </div>
          ))}
        </div>

        {/* ---- TABLE ---- */}
        <h2 style={{ marginTop: 40 }}>All symbols</h2>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Latest</th>
                <th>24h %</th>
                <th>24h Volume</th>
                <th>Last Candle</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((s) => (
                <tr key={s.symbol}>
                  <td>
                    <Link href={`/symbol/${encodeURIComponent(s.symbol)}`}>
                      {s.symbol}
                    </Link>
                  </td>
                  <td>{fmtNum(s.latest_close)}</td>
                  <td>{fmtPct(s.pct_change_24h)}</td>
                  <td>{fmtNum(s.volume_24h)}</td>
                  <td>{new Date(s.latest_bucket).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- CHARTS ---- */}
        <OverviewCharts series={series} />
      </main>
    );
  } finally {
    client?.release();
  }
}