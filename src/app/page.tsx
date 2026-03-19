import Link from "next/link";
import { getOverviewData } from "@/lib/getOverview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  let data: Awaited<ReturnType<typeof getOverviewData>>;

  try {
    data = await getOverviewData();
  } catch (err) {
    console.error("HomePage error:", err);
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>CryptoPulse</h1>
        <p>Failed to load overview. Please try again later.</p>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/prediction" className="btnPrimary">
            🔮 Get a Prediction
          </Link>
          <Link href="/about" className="btn">
            About
          </Link>
        </div>
      </main>
    );
  }

  const symbols = (data.symbols ?? []).filter(
    (r) => String(r.symbol).trim().toUpperCase() !== "BTCUSDT"
  );

  return (
    <main className="container" style={{ fontFamily: "system-ui" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>CryptoPulse</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Overview of tracked crypto pairs • Updated:{" "}
            {new Date(data.updated_at).toLocaleString()}
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/prediction"
              className="btn"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(99,102,241,0.35), 0 12px 30px rgba(99,102,241,0.12)",
              }}
            >
              🔮 Get a Prediction
            </Link>
            <Link href="/overview" className="btn">
              Overview
            </Link>
            <Link href="/about" className="btn">
              About
            </Link>
          </div>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        {symbols.map((r) => (
          <div key={r.symbol} className="glass" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>{r.symbol}</h2>
              <span style={{ opacity: 0.75, fontSize: 12 }}>
                {new Date(r.latest_bucket).toLocaleString()}
              </span>
            </div>

            <div style={{ marginTop: 12, fontSize: 34, fontWeight: 800 }}>
              {fmtNum(r.latest_close)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <div className="miniCard">
                <div className="miniLabel">24h change</div>
                <div className="miniValue">{fmtPct(r.pct_change_24h)}</div>
              </div>
              <div className="miniCard">
                <div className="miniLabel">24h volume</div>
                <div className="miniValue">{fmtNum(r.volume_24h)}</div>
              </div>
              <div className="miniCard">
                <div className="miniLabel">24h stdev</div>
                <div className="miniValue">{fmtNum(r.price_std_24h)}</div>
              </div>
              <div className="miniCard">
                <div className="miniLabel">24h ago close</div>
                <div className="miniValue">{fmtNum(r.close_24h_ago)}</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Link
                href={`/symbol/${encodeURIComponent(r.symbol)}`}
                className="btn"
                style={{ display: "inline-flex" }}
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
