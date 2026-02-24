import Link from "next/link";
import { headers } from "next/headers";
import OverviewCharts from "./OverviewCharts";

type OverviewRow = {
  symbol: string;
  latest_bucket: string;
  latest_close: number | null;
  close_24h_ago: number | null;
  pct_change_24h: number | null;
  volume_24h: number | null;
  price_std_24h: number | null;
};

type OverviewResponse = {
  updated_at: string;
  symbols: OverviewRow[];
  aggregate: {
    symbol_count: number;
    advancers: number;
    decliners: number;
    unchanged: number;
    total_volume_24h: number | null;
    avg_pct_change_24h: number | null;
  };
  series: { bucket: string; market_index: number | null; total_volume: number | null }[];
};

function fmtNum(x: number | null | undefined) {
  if (x === null || x === undefined) return "—";
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);
}

function fmtPct(x: number | null | undefined) {
  if (x === null || x === undefined) return "—";
  const v = x * 100;
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

export default async function OverviewPage() {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  const res = await fetch(`${proto}://${host}/api/overview`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Overview</h1>
        <p>Failed to load overview. Status: {res.status}</p>
        <Link href="/" style={{ textDecoration: "underline" }}>
          ← Back to Home
        </Link>
      </main>
    );
  }

  const data: OverviewResponse = await res.json();

  // Extra safety
  const symbols = (data.symbols ?? []).filter(
    (s) => String(s.symbol).trim().toUpperCase() !== "BTCUSDT"
  );

  const a = data.aggregate;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Overview</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Updated: {new Date(data.updated_at).toLocaleString()}
          </p>
        </div>
        <Link href="/" style={{ textDecoration: "underline" }}>
          ← Back to Home
        </Link>
      </header>

      {/* Summary cards */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Tracked symbols</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{a?.symbol_count ?? symbols.length}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Advancers / Decliners</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {a?.advancers ?? "—"} / {a?.decliners ?? "—"}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
            Unchanged: {a?.unchanged ?? "—"}
          </div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Total volume (24h)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtNum(a?.total_volume_24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Avg % change (24h)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtPct(a?.avg_pct_change_24h)}</div>
        </div>
      </section>

      {/* Charts */}
      <OverviewCharts series={data.series ?? []} />

      {/* Symbols table */}
      <section style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 10 }}>Symbols</h3>
        <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 10, borderBottom: "1px solid #333" }}>Symbol</th>
                <th style={{ padding: 10, borderBottom: "1px solid #333" }}>Latest</th>
                <th style={{ padding: 10, borderBottom: "1px solid #333" }}>24h %</th>
                <th style={{ padding: 10, borderBottom: "1px solid #333" }}>24h volume</th>
                <th style={{ padding: 10, borderBottom: "1px solid #333" }}>Last candle</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((r) => (
                <tr key={r.symbol}>
                  <td style={{ padding: 10, borderBottom: "1px solid #222" }}>
                    <Link
                      href={`/symbol/${encodeURIComponent(r.symbol)}`}
                      style={{ textDecoration: "underline" }}
                    >
                      {r.symbol}
                    </Link>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #222" }}>
                    {fmtNum(r.latest_close)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #222" }}>
                    {fmtPct(r.pct_change_24h)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #222" }}>
                    {fmtNum(r.volume_24h)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #222" }}>
                    {new Date(r.latest_bucket).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
