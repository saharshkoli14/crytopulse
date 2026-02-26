import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "public.ohlcv_1m";
const COL_SYMBOL = "symbol";
const COL_BUCKET = "bucket";
const COL_CLOSE = "close";
const COL_HIGH = "high";
const COL_LOW = "low";
const COL_VOLUME = "volume";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function mustEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ symbol: string }> }
) {
  try {
    mustEnv("DATABASE_URL", process.env.DATABASE_URL);

    const { symbol } = await ctx.params;
    const url = new URL(req.url);

    const limit = Math.min(
      3000,
      Math.max(10, Number(url.searchParams.get("limit") ?? "1440"))
    );

    // --- Latest candle
    const qLatest = `
      SELECT ${COL_BUCKET} AS bucket, ${COL_CLOSE} AS close
      FROM ${TABLE}
      WHERE ${COL_SYMBOL} = $1
      ORDER BY ${COL_BUCKET} DESC
      LIMIT 1
    `;
    const latestRes = await pool.query<{ bucket: string; close: unknown }>(qLatest, [symbol]);
    const latestRow = latestRes.rows?.[0];
    const latestBucket = latestRow?.bucket ?? null;
    const latestClose = toNum(latestRow?.close);

    // --- 24h stats (high/low/volume + close_24h_ago)
    const q24h = `
      WITH w AS (
        SELECT
          ${COL_BUCKET} AS bucket,
          ${COL_CLOSE}  AS close,
          ${COL_HIGH}   AS high,
          ${COL_LOW}    AS low,
          ${COL_VOLUME} AS volume
        FROM ${TABLE}
        WHERE ${COL_SYMBOL} = $1
          AND ${COL_BUCKET} >= now() - interval '24 hours'
        ORDER BY ${COL_BUCKET} ASC
      )
      SELECT
        (array_agg(close ORDER BY bucket ASC))[1] AS close_24h_ago,
        MAX(high) AS high_24h,
        MIN(low)  AS low_24h,
        SUM(volume) AS volume_24h
      FROM w;
    `;
    const s24 = await pool.query<{
      close_24h_ago: unknown;
      high_24h: unknown;
      low_24h: unknown;
      volume_24h: unknown;
    }>(q24h, [symbol]);

    const row24 = s24.rows?.[0];
    const close24hAgo = toNum(row24?.close_24h_ago);
    const high24h = toNum(row24?.high_24h);
    const low24h = toNum(row24?.low_24h);
    const volume24h = toNum(row24?.volume_24h);

    const pctChange24h =
      latestClose !== null && close24hAgo !== null && close24hAgo !== 0
        ? (latestClose - close24hAgo) / close24hAgo
        : null;

    // --- Series for charts
    const qSeries = `
      SELECT ${COL_BUCKET} AS bucket,
             ${COL_CLOSE}  AS close,
             ${COL_VOLUME} AS volume
      FROM ${TABLE}
      WHERE ${COL_SYMBOL} = $1
      ORDER BY ${COL_BUCKET} DESC
      LIMIT $2
    `;
    const seriesRes = await pool.query<{ bucket: string; close: unknown; volume: unknown }>(
      qSeries,
      [symbol, limit]
    );

    const seriesDesc = seriesRes.rows ?? [];
    const points = seriesDesc
      .slice()
      .reverse()
      .map((r) => ({
        bucket: r.bucket,
        close: toNum(r.close),
        volume: toNum(r.volume),
      }));

    if (!latestBucket || latestClose === null) {
      return NextResponse.json(
        { ok: false, error: `No data found for symbol ${symbol}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        symbol,
        updatedAt: new Date().toISOString(), // ✅ fixes "Invalid Date"
        stats: {
          latestBucket,
          latestClose,
          close24hAgo,
          pctChange24h,
          high24h,
          low24h,
          volume24h,
        },
        points,      // what your page debug uses
        series: points,
        // backwards compatibility
        latest_bucket: latestBucket,
        latest_close: latestClose,
        rows: seriesDesc,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}