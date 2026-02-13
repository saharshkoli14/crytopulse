type Props = { params: { symbol: string } };

export default function SymbolPage({ params }: Props) {
  return (
    <main style={{ padding: 24 }}>
      <h1>{params.symbol}</h1>
      <p>Next step: show charts, indicators, and prediction here.</p>
    </main>
  );
}
