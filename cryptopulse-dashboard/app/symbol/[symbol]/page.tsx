import Link from "next/link";
import SymbolCharts from "./SymbolCharts";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

type Point = {
  bucket: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type ApiResponse = {
  updatedAt: string;
  symbol: string;
  points: Point[];
  stats: {
    latestClose: number | null;
    pctChange24h: number | null;
    high24h: number | null;
    low24h: number | null;
    volume24h: number | null;
  };
};

function fmtNum(x: number | null | undefined) {
  if (x == null) return "—";
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);
}

function fmtPct(x: number | null | undefined) {
  if (x == null) return "—";
  const v = x * 100;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export default async function SymbolPage({ params }: PageProps) {
  const { symbol } = await params;

  // ✅ IMPORTANT: use relative fetch
  const res = await fetch(`/api/symbol/${symbol}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API failed with status ${res.status}`);
  }

  const data = (await res.json()) as ApiResponse;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>{data.symbol} — Details</h1>
          <p>Updated: {new Date(data.updatedAt).toLocaleString()}</p>
        </div>

        <Link href="/overview">← Back to Overview</Link>
      </header>

      {/* Stats */}
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Stat title="Latest Close" value={fmtNum(data.stats.latestClose)} />
        <Stat title="24h Change" value={fmtPct(data.stats.pctChange24h)} />
        <Stat title="24h High" value={fmtNum(data.stats.high24h)} />
        <Stat title="24h Low" value={fmtNum(data.stats.low24h)} />
        <Stat title="24h Volume" value={fmtNum(data.stats.volume24h)} />
      </section>

      <SymbolCharts points={data.points} />
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}