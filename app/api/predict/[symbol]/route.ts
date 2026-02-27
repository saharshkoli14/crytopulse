import { NextResponse, type NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "A" | "D";
type Confidence = "LOW" | "MED" | "HIGH";

// ✅ Your real table:
const TABLE = "public.ohlcv_1m";
const COL_SYMBOL = "symbol";
const COL_BUCKET = "bucket";
const COL_CLOSE = "close";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function mustEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function confidenceFrom(p: number, n: number): Confidence {
  if (n >= 600 && (p <= 0.35 || p >= 0.65)) return "HIGH";
  if (n >= 250) return "MED";
  return "LOW";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ symbol: string }> }
) {
  try {
    mustEnv("DATABASE_URL", process.env.DATABASE_URL);

    const { symbol } = await ctx.params;
    const url = new URL(req.url);

    const mode = (url.searchParams.get("mode") ?? "D") as Mode;
    const horizonMinutes = clamp(
      Number(url.searchParams.get("horizon") ?? "60"),
      5,
      240
    );
    const thr = clamp(
      Number(url.searchParams.get("thr") ?? "0.0035"),
      0.0005,
      0.05
    );

    // 1-minute candles assumption
    const horizonSteps = horizonMinutes;
    const LIMIT = clamp(1200 + horizonSteps, 300, 5000);

    const sql = `
      SELECT ${COL_BUCKET} as bucket, ${COL_CLOSE} as close
      FROM ${TABLE}
      WHERE ${COL_SYMBOL} = $1
      ORDER BY ${COL_BUCKET} DESC
      LIMIT $2
    `;

    const { rows } = await pool.query<{ bucket: string; close: number }>(sql, [
      symbol,
      LIMIT,
    ]);

    if (!rows || rows.length < horizonSteps + 30) {
      return NextResponse.json(
        { ok: false, error: "Not enough candle data to compute prediction." },
        { status: 400 }
      );
    }

    const asc = [...rows].reverse();
    const latest = asc[asc.length - 1];

    const asof_bucket = latest.bucket;
    const asof_close = Number(latest.close);

    let total = 0;
    let up = 0;
    let strongUp = 0;

    for (let i = 0; i + horizonSteps < asc.length; i++) {
      const c0 = Number(asc[i].close);
      const c1 = Number(asc[i + horizonSteps].close);
      if (!Number.isFinite(c0) || !Number.isFinite(c1) || c0 <= 0) continue;

      const ret = (c1 - c0) / c0;
      total += 1;

      if (ret > 0) up += 1;
      if (ret >= thr) strongUp += 1;
    }

    if (total < 30) {
      return NextResponse.json(
        { ok: false, error: "Insufficient valid samples for prediction." },
        { status: 400 }
      );
    }

    if (mode === "A") {
      const prob_up = up / total;
      const direction = prob_up >= 0.5 ? "UP" : "DOWN";
      const confidence = confidenceFrom(prob_up, total);

      return NextResponse.json(
        {
          ok: true,
          symbol,
          horizon_minutes: horizonMinutes,
          mode: "A",
          asof_bucket,
          asof_close,
          prob_up,
          direction,
          confidence,
          model_metrics: {
            positive_rate: prob_up,
            samples: total,
            note: "Heuristic probability from historical horizon returns",
          },
        },
        { status: 200 }
      );
    }

    const prob_strong_up = strongUp / total;
    const signal = prob_strong_up >= 0.5 ? "STRONG_UP" : "NO_SIGNAL";
    const confidence = confidenceFrom(prob_strong_up, total);

    return NextResponse.json(
      {
        ok: true,
        symbol,
        horizon_minutes: horizonMinutes,
        mode: "D",
        thr,
        asof_bucket,
        asof_close,
        prob_strong_up,
        signal,
        confidence,
        model_metrics: {
          positive_rate: prob_strong_up,
          samples: total,
          note: "Heuristic strong-up probability from historical horizon returns",
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}