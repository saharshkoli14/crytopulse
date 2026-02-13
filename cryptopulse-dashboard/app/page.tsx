import Link from "next/link";

type OverviewRow = {
  symbol: string;
  latest_bucket: string;
  latest_close: number;
  close_24h_ago: number | null;
  pct_change_24h: number | null;
  volume_24h: number | null;
  price_std_24h: number | null;
};

type OverviewResponse = {
  updated_at: string;
  symbols: OverviewRow[];
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

export default async function HomePage() {
  const res = await fetch("http://localhost:3000/api/overview", {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>CryptoPulse</h1>
        <p>Failed to load overview. Status: {res.status}</p>
      </main>
    );
  }

  const data: OverviewResponse = await res.json();

  // ✅ REMOVE BTCUSDT (handles case/whitespace)
  const symbols = (data.symbols ?? []).filter(
    (r) => String(r.symbol).trim().toUpperCase() !== "BTCUSDT"
  );

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>CryptoPulse</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Overview of tracked crypto pairs • Updated:{" "}
            {new Date(data.updated_at).toLocaleString()}
          </p>
        </div>

        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/" style={{ textDecoration: "underline" }}>
            Overview
          </Link>
        </nav>
      </header>

      {/* Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        {symbols.map((r) => (
          <div
            key={r.symbol}
            style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>{r.symbol}</h2>
              <span style={{ opacity: 0.75, fontSize: 12 }}>
                {new Date(r.latest_bucket).toLocaleString()}
              </span>
            </div>

            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}>
              {fmtNum(r.latest_close)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 10,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ opacity: 0.7 }}>24h change</div>
                <div>{fmtPct(r.pct_change_24h)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>24h volume</div>
                <div>{fmtNum(r.volume_24h)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>24h stdev</div>
                <div>{fmtNum(r.price_std_24h)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>24h ago close</div>
                <div>{fmtNum(r.close_24h_ago)}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <Link
                href={`/symbol/${encodeURIComponent(r.symbol)}`}
                style={{ textDecoration: "underline" }}
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </section>

      {/* Table */}
      <section style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 10 }}>All symbols</h3>
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
