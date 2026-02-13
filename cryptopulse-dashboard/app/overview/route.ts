import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const client = await pool.connect();

    // Get latest bucket per symbol
    const result = await client.query(`
      SELECT
        symbol,
        MAX(bucket) AS latest_bucket
      FROM crypto_1m
      GROUP BY symbol
    `);

    const symbols = [];

    for (const row of result.rows) {
      const { symbol, latest_bucket } = row;

      // Latest candle
      const latest = await client.query(
        `
        SELECT close, volume
        FROM crypto_1m
        WHERE symbol = $1
        AND bucket = $2
        `,
        [symbol, latest_bucket]
      );

      // 24h ago candle (approx 1440 minutes earlier)
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

      // 24h stats
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

      const latestClose = latest.rows[0]?.close ?? null;
      const close24hAgo = prev.rows[0]?.close ?? null;
      const volume24h = stats.rows[0]?.volume_24h ?? null;
      const priceStd24h = stats.rows[0]?.price_std_24h ?? null;

      let pctChange24h = null;
      if (latestClose && close24hAgo) {
        pctChange24h =
          (latestClose - close24hAgo) / close24hAgo;
      }

      symbols.push({
        symbol,
        latest_bucket,
        latest_close: latestClose,
        close_24h_ago: close24hAgo,
        pct_change_24h: pctChange24h,
        volume_24h: volume24h,
        price_std_24h: priceStd24h,
      });
    }

    client.release();

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      symbols,
    });

  } catch (error) {
    console.error("Overview API error:", error);
    return NextResponse.json(
      { error: "Failed to load overview data" },
      { status: 500 }
    );
  }
}
