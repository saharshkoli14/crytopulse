import Link from "next/link";
import { headers } from "next/headers";
import SymbolCharts from "./SymbolCharts";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { symbol: string };
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

type Point = {
  bucket: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type Normalized = {
  updatedAtISO: string;
  symbol: string;
  points: Point[];
  stats: {
    latestBucket: string | null;
    latestClose: number | null;
    pctChange24h: number | null;
    high24h: number | null;
    low24h: number | null;
    volume24h: number | null;
  };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getProp(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

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

function normalize(raw: unknown, fallbackSymbol: string): Normalized {
  const updated =
    getProp(raw, "updatedAt") ??
    getProp(raw, "updated_at") ??
    getProp(raw, "updated") ??
    getProp(raw, "updatedISO") ??
    new Date().toISOString();

  const sym = getProp(raw, "symbol");
  const symbol = sym ? String(sym) : fallbackSymbol;

  const pointsRaw = getProp(raw, "points");
  const points: Point[] = Array.isArray(pointsRaw) ? (pointsRaw as Point[]) : [];

  const statsRaw = getProp(raw, "stats");

  const latestBucket =
    (toStr(getProp(statsRaw, "latestBucket")) ??
      toStr(getProp(statsRaw, "latest_bucket")) ??
      toStr(getProp(statsRaw, "latest_bucket_ts"))) ?? null;

  const latestClose = toNum(getProp(statsRaw, "latestClose") ?? getProp(statsRaw, "latest_close"));
  const pctChange24h = toNum(getProp(statsRaw, "pctChange24h") ?? getProp(statsRaw, "pct_change_24h"));
  const high24h = toNum(getProp(statsRaw, "high24h") ?? getProp(statsRaw, "high_24h"));
  const low24h = toNum(getProp(statsRaw, "low24h") ?? getProp(statsRaw, "low_24h"));
  const volume24h = toNum(getProp(statsRaw, "volume24h") ?? getProp(statsRaw, "volume_24h"));

  return {
    updatedAtISO: String(updated),
    symbol,
    points,
    stats: { latestBucket, latestClose, pctChange24h, high24h, low24h, volume24h },
  };
}

export default async function SymbolPage({ params }: PageProps) {
  const symbol = decodeURIComponent(params.symbol);

  const baseUrl = await getBaseUrl();
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

  const raw = (await res.json()) as unknown;
  const data = normalize(raw, symbol);

  const updatedDate = new Date(data.updatedAtISO);
  const updatedText = Number.isNaN(updatedDate.getTime()) ? data.updatedAtISO : updatedDate.toLocaleString();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>{data.symbol} — Details</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>Updated: {updatedText}</p>
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
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Latest close</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.latestClose)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h change</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtPct(data.stats.pctChange24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h high</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.high24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h low</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.low24h)}</div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>24h volume</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(data.stats.volume24h)}</div>
        </div>
      </section>

      <SymbolCharts points={data.points} />

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>Debug: last 10 points</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
          {JSON.stringify(data.points.slice(-10), null, 2)}
        </pre>
      </details>
    </main>
  );
}