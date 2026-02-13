export default async function OverviewPage() {
  const res = await fetch("http://localhost:3000/api/overview", { cache: "no-store" });
  const data = await res.json();

  return (
    <main style={{ padding: 24 }}>
      <h1>Overview</h1>
      <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
