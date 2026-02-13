import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  // Overview per symbol using 1-minute OHLCV (preferred)
  // If you only have ticks, we can adjust, but you already have ohlcv_1m working.
  const q = `
    WITH latest AS (
      SELECT DISTINCT ON (symbol)
        symbol,
        bucket AS latest_bucket,
        close  AS latest_close
      FROM public.ohlcv_1m
      ORDER BY symbol, bucket DESC
    ),
    window_24h AS (
      SELECT
        symbol,
        MIN(bucket) AS first_bucket,
        MAX(bucket) AS last_bucket,
        (array_agg(close ORDER BY bucket ASC))[1]  AS close_24h_ago,
        (array_agg(close ORDER BY bucket DESC))[1] AS close_now,
        SUM(volume) AS volume_24h,
        STDDEV_SAMP(close) AS price_std_24h
      FROM public.ohlcv_1m
      WHERE bucket >= now() - interval '24 hours'
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

  const { rows } = await pool.query(q);

  return Response.json({
    updated_at: new Date().toISOString(),
    symbols: rows,
  });
}
