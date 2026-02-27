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

type ApiStats = {
  // camelCase
  latestClose?: number | null;
  pctChange24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  volume24h?: number | null;

  // snake_case (backwards compat)
  latest_close?: number | null;
  pct_change_24h?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  volume_24h?: number | null;
};

type ApiResponse = {
  updatedAt?: string;
  updated_at?: string;

  symbol: string;

  points?: Array<{
    bucket: string;
    close: number | null;
    volume: number | null;
  }>;

  stats?: ApiStats;
};

function mustBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_BASE_URL;
  if (v && v.startsWith("http")) return v.replace(/\/+$/, "");
  return "http://localhost:3000";
}

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

function pickStat(stats: ApiStats | undefined, camel: keyof ApiStats, snake: keyof ApiStats) {
  if (!stats) return null;

  const a = stats[camel];
  if (a !== undefined) return a as number | null;

  const b = stats[snake];
  if (b !== undefined) return b as number | null;

  return null;
}

export default async function SymbolPage({ params }: PageProps) {
  const { symbol } = await params;

  const baseUrl = mustBaseUrl();
  const res = await fetch(`${baseUrl}/api/symbol/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>{symbol} — Details</h1>
        <p>Failed to load symbol data.</p>
        <p>Status: {res.status}</p>
        <p>
          <Link href="/overview" style={{ textDecoration: "underline" }}>
            ← Back to Overview
          </Link>
        </p>
      </main>
    );
  }

  const data = (await res.json()) as ApiResponse;

  const updated = data.updatedAt ?? data.updated_at ?? null;
  const stats = data.stats;

  const latestClose = pickStat(stats, "latestClose", "latest_close");
  const pctChange24h = pickStat(stats, "pctChange24h", "pct_change_24h");
  const high24h = pickStat(stats, "high24h", "high_24h");
  const low24h = pickStat(stats, "low24h", "low_24h");
  const volume24h = pickStat(stats, "volume24h", "volume_24h");

  const points: Point[] = Array.isArray(data.points)
    ? data.points.map((p) => ({
        bucket: p.bucket,
        open: null,
        high: null,
        low: null,
        close: p.close ?? null,
        volume: p.volume ?? null,
      }))
    : [];

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>{data.symbol} — Details</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Updated: {updated ? new Date(updated).toLocaleString() : "—"}
          </p>
        </div>

        <Link href="/overview" style={{ textDecoration: "underline" }}>
          ← Back to Overview
        </Link>
      </header>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Stat title="Latest Close" value={fmtNum(latestClose)} />
        <Stat title="24h Change" value={fmtPct(pctChange24h)} />
        <Stat title="24h High" value={fmtNum(high24h)} />
        <Stat title="24h Low" value={fmtNum(low24h)} />
        <Stat title="24h Volume" value={fmtNum(volume24h)} />
      </section>

      <SymbolCharts points={points} />
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}