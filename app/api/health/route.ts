import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const res = await pool.query("select 1 as ok");
  return Response.json(res.rows[0]);
}
