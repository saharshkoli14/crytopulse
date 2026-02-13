import Link from "next/link";
import SymbolCharts from "./SymbolCharts";

type Props = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params;

  const res = await fetch(
    `http://localhost:3000/api/symbol/${encodeURIComponent(symbol)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>{symbol} — Details</h1>
        <p>Failed to load symbol data.</p>
        <p>Status: {res.status}</p>
        <p>
          <Link href="/" style={{ textDecoration: "underline" }}>
            ← Back to Overview
          </Link>
        </p>
      </main>
    );
  }

  const data: {
    updated_at: string;
    symbol: string;
    range: string;
    points: Array<{
      bucket: string;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      volume: number | null;
    }>;
    stats: {
      latest_bucket: string;
      latest_close: number | null;
      pct_change_24h: number | null;
      high_24h: number | null;
      low_24h: number | null;
      volume_24h: number | null;
    };
  } = await res.json();

  const fmtNum = (x: number | null | undefined) =>
    x == null ? "—" : Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);

  const fmtPct = (x: number | null | undefined) => {
    if (x == null) return "—";
    const v = x * 100;
    const s = v >= 0 ? "+" : "";
    return `${s}${v.toFixed(2)}%`;
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>{symbol} — Details</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Updated: {new Date(data.updated_at).toLocaleString()}
          </p>
        </div>

        <Link href="/" style={{ textDecoration: "underline" }}>
          ← Back to Overview
        </Link>
      </header>

      {/* Quick stats cards */}
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Latest close</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.latest_close)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h change</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtPct(data.stats.pct_change_24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h high</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.high_24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h low</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.low_24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h volume</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.volume_24h)}</div>
        </div>
      </section>

      {/* Charts */}
      <SymbolCharts points={data.points} />

      {/* Optional: keep a small raw preview for debugging */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>Debug: last 10 points</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
          {JSON.stringify(data.points.slice(-10), null, 2)}
        </pre>
      </details>
    </main>
  );
}
