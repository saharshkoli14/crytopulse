import Link from "next/link";
import SimplePredict from "../../components/SimplePredict";

export default function PredictionPage() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          ← Back to Home
        </Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <SimplePredict />
      </div>
    </main>
  );
}