import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  let client;
  try {
    client = await pool.connect();

    const result = await client.query(`
      SELECT symbol, MAX(bucket) AS latest_bucket
      FROM crypto_1m
      GROUP BY symbol
    `);

    const symbols: any[] = [];

    for (const row of result.rows) {
      const symbol = row.symbol;
      const latest_bucket = row.latest_bucket;

      // Latest candle (make sure it's exactly 1 row)
      const latest = await client.query(
        `
        SELECT close, volume
        FROM crypto_1m
        WHERE symbol = $1 AND bucket = $2
        ORDER BY bucket DESC
        LIMIT 1
        `,
        [symbol, latest_bucket]
      );

      const prev = await client.query(
        `
        SELECT close
        FROM crypto_1m
        WHERE symbol = $1
          AND bucket <= $2 - INTERVAL '24 hours'
        ORDER BY bucket DESC
        LIMIT 1
        `,
        [symbol, latest_bucket]
      );

      const stats = await client.query(
        `
        SELECT
          SUM(volume) AS volume_24h,
          STDDEV(close) AS price_std_24h
        FROM crypto_1m
        WHERE symbol = $1
          AND bucket >= $2 - INTERVAL '24 hours'
        `,
        [symbol, latest_bucket]
      );

      // pg can return numerics as strings → safely parse
      const latestClose = latest.rows[0]?.close ?? null;
      const close24hAgo = prev.rows[0]?.close ?? null;

      const latestCloseNum = latestClose == null ? null : Number(latestClose);
      const close24hAgoNum = close24hAgo == null ? null : Number(close24hAgo);

      const volume24h = stats.rows[0]?.volume_24h ?? null;
      const priceStd24h = stats.rows[0]?.price_std_24h ?? null;

      let pctChange24h = null;
      if (latestCloseNum != null && close24hAgoNum != null && close24hAgoNum !== 0) {
        pctChange24h = (latestCloseNum - close24hAgoNum) / close24hAgoNum;
      }

      symbols.push({
        symbol,
        latest_bucket,
        latest_close: latestCloseNum,
        close_24h_ago: close24hAgoNum,
        pct_change_24h: pctChange24h,
        volume_24h: volume24h == null ? null : Number(volume24h),
        price_std_24h: priceStd24h == null ? null : Number(priceStd24h),
      });
    }

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      symbols,
    });
  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json({ error: "Failed to load overview data" }, { status: 500 });
  } finally {
    client?.release();
  }
}
