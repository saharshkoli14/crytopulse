import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  let client: any;
  try {
    client = await pool.connect();

    // ✅ remove BTCUSDT at the source
    const result = await client.query(`
      SELECT symbol, MAX(bucket) AS latest_bucket
      FROM crypto_1m
      WHERE symbol <> 'BTCUSDT'
      GROUP BY symbol
    `);

    const symbols: any[] = [];

    for (const row of result.rows) {
      const symbol = row.symbol;
      const latest_bucket = row.latest_bucket;

      // latest candle (1 row)
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

      // close ~24h ago
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

      // pg may return numerics as strings -> convert safely
      const latestCloseRaw = latest.rows[0]?.close ?? null;
      const close24hAgoRaw = prev.rows[0]?.close ?? null;

      const latestClose = latestCloseRaw == null ? null : Number(latestCloseRaw);
      const close24hAgo = close24hAgoRaw == null ? null : Number(close24hAgoRaw);

      const volume24hRaw = stats.rows[0]?.volume_24h ?? null;
      const priceStd24hRaw = stats.rows[0]?.price_std_24h ?? null;

      const volume24h = volume24hRaw == null ? null : Number(volume24hRaw);
      const priceStd24h = priceStd24hRaw == null ? null : Number(priceStd24hRaw);

      let pctChange24h: number | null = null;
      if (latestClose != null && close24hAgo != null && close24hAgo !== 0) {
        pctChange24h = (latestClose - close24hAgo) / close24hAgo;
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
  } finally {
    if (client) client.release();
  }
}
