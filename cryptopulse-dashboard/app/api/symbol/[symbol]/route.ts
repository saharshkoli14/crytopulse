import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CHANGE THESE TO MATCH YOUR DB ======
const DEFAULT_TABLE = "candles_1m"; // e.g. "candles_1m" or "candles"
const COL_SYMBOL = "symbol";
const COL_BUCKET = "bucket";
const COL_CLOSE = "close";
// ==========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function mustEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ symbol: string }> } // ✅ Next.js 15
) {
  try {
    mustEnv("DATABASE_URL", process.env.DATABASE_URL);

    const { symbol } = await ctx.params;
    const url = new URL(req.url);

    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? "500")));

    // Optional: if you store multiple timeframes in separate tables, you can map tf->table here.
    const tf = url.searchParams.get("tf") ?? "1m";
    const table =
      tf === "1m" ? DEFAULT_TABLE :
      tf === "5m" ? "candles_5m" :
      tf === "15m" ? "candles_15m" :
      DEFAULT_TABLE;

    const sql = `
      SELECT *
      FROM ${table}
      WHERE ${COL_SYMBOL} = $1
      ORDER BY ${COL_BUCKET} DESC
      LIMIT $2
    `;

    const { rows } = await pool.query(sql, [symbol, limit]);

    return NextResponse.json(
      { ok: true, symbol, tf, count: rows.length, rows },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}