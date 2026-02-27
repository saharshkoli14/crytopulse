import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";

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

export async function GET() {
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // --- Per-symbol overview (latest + 24h window stats)
    const qSymbols = `
      WITH latest AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          bucket AS latest_bucket,
          close  AS latest_close
        FROM public.ohlcv_1m
        WHERE symbol <> 'BTCUSDT'
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
          AND symbol <> 'BTCUSDT'
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
    const symbolRowsRaw = symbolRes.rows;

    const symbols = (symbolRowsRaw ?? []).map((r) => ({
      symbol: r.symbol,
      latest_bucket: r.latest_bucket,
      latest_close: toNum(r.latest_close),
      close_24h_ago: toNum(r.close_24h_ago),
      pct_change_24h: toNum(r.pct_change_24h),
      volume_24h: toNum(r.volume_24h),
      price_std_24h: toNum(r.price_std_24h),
    }));

    // --- Market-wide series (last 24h, 1m)
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
          AND symbol <> 'BTCUSDT'
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
    const seriesRowsRaw = seriesRes.rows;

    const series = (seriesRowsRaw ?? []).map((r) => ({
      bucket: r.bucket,
      market_index: toNum(r.market_index),
      total_volume: toNum(r.total_volume),
    }));

    // --- Aggregate stats (computed in JS)
    const pctVals = symbols
      .map((s) => s.pct_change_24h)
      .filter((x): x is number => typeof x === "number");

    const volumeVals = symbols
      .map((s) => s.volume_24h)
      .filter((x): x is number => typeof x === "number");

    const advancers = pctVals.filter((x) => x > 0).length;
    const decliners = pctVals.filter((x) => x < 0).length;
    const unchanged = pctVals.filter((x) => x === 0).length;

    const aggregate = {
      symbol_count: symbols.length,
      advancers,
      decliners,
      unchanged,
      total_volume_24h: volumeVals.reduce((a, b) => a + b, 0),
      avg_pct_change_24h: pctVals.length
        ? pctVals.reduce((a, b) => a + b, 0) / pctVals.length
        : null,
    };

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      symbols,
      aggregate,
      series,
    });
  } catch (err: unknown) {
    console.error("Overview API error:", err);
    return NextResponse.json(
      { error: "Failed to load overview data" },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}