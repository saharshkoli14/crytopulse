import Link from "next/link";
import { headers } from "next/headers";
import SymbolCharts from "./SymbolCharts";

type Props = {
  params: Promise<{ symbol: string }>;
};

type ApiPoint = {
  bucket: string;
  close: number | null;
  volume: number | null;
};

type ApiResponse = {
  ok: true;
  symbol: string;
  updatedAt: string;
  stats: {
    latestBucket: string;
    latestClose: number | null;
    close24hAgo: number | null;
    pctChange24h: number | null;
    high24h: number | null;
    low24h: number | null;
    volume24h: number | null;
  };
  points: ApiPoint[];
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000"; // safe fallback
  return `${proto}://${host}`;
}

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params;

  const baseUrl = getBaseUrl();

  const res = await fetch(
    `${baseUrl}/api/symbol/${encodeURIComponent(symbol)}`,
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

  const data = (await res.json()) as ApiResponse;

  const fmtNum = (x: number | null | undefined) =>
    x == null ? "—" : Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);

  const fmtPct = (x: number | null | undefined) => {
    if (x == null) return "—";
    const v = x * 100;
    const s = v >= 0 ? "+" : "";
    return `${s}${v.toFixed(2)}%`;
  };

  const updatedLabel = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—";

  // Convert API points to what SymbolCharts expects
  const chartPoints = (data.points ?? []).map((p) => ({
    bucket: p.bucket,
    open: null,
    high: null,
    low: null,
    close: p.close,
    volume: p.volume,
  }));

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>{symbol} — Details</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>Updated: {updatedLabel}</p>
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
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats?.latestClose)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h change</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtPct(data.stats?.pctChange24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h high</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats?.high24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h low</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats?.low24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h volume</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats?.volume24h)}</div>
        </div>
      </section>

      {/* Charts */}
      <SymbolCharts points={chartPoints} />

      {/* Debug */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>Debug: last 10 points</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
          {JSON.stringify((data.points ?? []).slice(-10), null, 2)}
        </pre>
      </details>
    </main>
  );
}