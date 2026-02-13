import { headers } from "next/headers";

export default async function OverviewPage() {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  const res = await fetch(`${proto}://${host}/api/overview`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Overview</h1>
        <p>Failed to load overview</p>
      </main>
    );
  }

  const data = await res.json();

  // ✅ remove BTCUSDT at UI level
  const symbols =
    (data.symbols ?? []).filter(
      (s: any) => String(s.symbol).trim().toUpperCase() !== "BTCUSDT"
    );

  return (
    <main style={{ padding: 24 }}>
      <h1>Overview</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify({ ...data, symbols }, null, 2)}
      </pre>
    </main>
  );
}
