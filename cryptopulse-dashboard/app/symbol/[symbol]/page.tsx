export default function SymbolPage({ params }: { params: { symbol: string } }) {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Symbol: {params.symbol}</h1>
      <p>Next step: show charts + indicators + prediction here.</p>
      <a href="/" style={{ textDecoration: "underline" }}>← Back to overview</a>
    </main>
  );
}
