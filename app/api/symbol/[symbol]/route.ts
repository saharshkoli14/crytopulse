import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

type Row = {
  bucket: string;
  open: string | number | null;
  high: string | number | null;
  low: string | number | null;
  close: string | number | null;
  volume: string | number | null;
};

const toNum = (v: any) => (v == null ? null : Number(v));

export async function GET(request: Request) {
  const { pathname } = new URL(request.url);
  const symbol = decodeURIComponent(pathname.split("/").pop() || "");

  let client: any;
  try {
    client = await pool.connect();

    // ✅ correct table name (from your screenshot)
    const candles = await client.query<Row>(
      `
      SELECT bucket, open, high, low, close, volume
      FROM public.ohlcv_1m
      WHERE symbol = $1
      ORDER BY bucket DESC
      LIMIT 1440
      `,
      [symbol]
    );

    const points = candles.rows
      .reverse()
      .map((r) => ({
        bucket: r.bucket,
        open: toNum(r.open),
        high: toNum(r.high),
        low: toNum(r.low),
        close: toNum(r.close),
        volume: toNum(r.volume),
      }));

    if (points.length === 0) {
      return NextResponse.json({ error: `No data for symbol: ${symbol}` }, { status: 404 });
    }

    const closes = points.map((p) => p.close).filter((x): x is number => x != null);
    const vols = points.map((p) => p.volume).filter((x): x is number => x != null);

    const latest = points[points.length - 1];
    const first = points[0];

    const latestClose = latest.close ?? null;
    const firstClose = first.close ?? null;

    const pct24h =
      latestClose != null && firstClose != null && firstClose !== 0
        ? (latestClose - firstClose) / firstClose
        : null;

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      symbol,
      range: "24h",
      points,
      stats: {
        latest_bucket: latest.bucket,
        latest_close: latestClose,
        pct_change_24h: pct24h,
        high_24h: closes.length ? Math.max(...closes) : null,
        low_24h: closes.length ? Math.min(...closes) : null,
        volume_24h: vols.length ? vols.reduce((a, b) => a + b, 0) : null,
      },
    });
  } catch (error) {
    console.error("Symbol API error:", error);
    return NextResponse.json({ error: "Failed to load symbol data" }, { status: 500 });
  } finally {
    client?.release();
  }
}
