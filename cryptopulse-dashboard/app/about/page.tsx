import Link from "next/link";

export default function AboutPage() {
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
          <Link href="/" style={{ textDecoration: "underline", opacity: 0.9 }}>
            ← Back to Home
          </Link>
          <h1 style={{ margin: "10px 0 0", fontSize: 34 }}>About CryptoPulse</h1>
          <p style={{ marginTop: 8, opacity: 0.82, maxWidth: 820 }}>
            CryptoPulse is a simple dashboard that turns market data into clear, readable signals —
            so you can make faster decisions without staring at charts all day.
          </p>
        </div>
      </header>

      {/* What this does */}
      <section className="glass" style={{ padding: 18, marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>What this website does</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div className="miniCard" style={{ padding: 14 }}>
            <div className="miniLabel">Live market snapshot</div>
            <div className="miniValue" style={{ marginTop: 6, opacity: 0.9 }}>
              See price, 24h change, volume, and volatility for BTC, ETH, and SOL in one place.
            </div>
          </div>

          <div className="miniCard" style={{ padding: 14 }}>
            <div className="miniLabel">Simple prediction signal</div>
            <div className="miniValue" style={{ marginTop: 6, opacity: 0.9 }}>
              Pick a coin, a time window, and get a clear result like “Likely Up/Down” or
              “Strong Up signal”.
            </div>
          </div>

          <div className="miniCard" style={{ padding: 14 }}>
            <div className="miniLabel">Details when you want them</div>
            <div className="miniValue" style={{ marginTop: 6, opacity: 0.9 }}>
              Non-technical users can stick to the simple view. Technical users can open
              model details + metrics.
            </div>
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="glass" style={{ padding: 18, marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>How to use it (simple)</h2>

        <ol style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.7, paddingLeft: 18 }}>
          <li>
            Go to <b>Prediction</b> from the Home page.
          </li>
          <li>
            Choose your <b>coin</b> (BTCUSD, ETHUSD, SOLUSD).
          </li>
          <li>
            Choose your <b>time window</b> (15–120 minutes).
          </li>
          <li>
            Choose the <b>prediction type</b>:
            <ul style={{ marginTop: 6, opacity: 0.9 }}>
              <li>
                <b>Direction</b>: simple “Likely Up” vs “Likely Down”.
              </li>
              <li>
                <b>Strong move</b>: checks for a stronger “up-move” signal using a threshold.
              </li>
            </ul>
          </li>
          <li>
            Read the result card:
            <ul style={{ marginTop: 6, opacity: 0.9 }}>
              <li>
                <b>Headline</b> (Up/Down/No signal)
              </li>
              <li>
                <b>Confidence</b> (Low/Medium/High)
              </li>
              <li>
                <b>Plain explanation</b> (simple language)
              </li>
            </ul>
          </li>
        </ol>

        <div className="miniCard" style={{ padding: 14, marginTop: 12 }}>
          <div className="miniLabel">Important note</div>
          <div className="miniValue" style={{ marginTop: 6, opacity: 0.92 }}>
            CryptoPulse is designed to support decisions — not guarantee outcomes. Always combine
            signals with your own risk management.
          </div>
        </div>
      </section>

      {/* Creator */}
      <section className="glass" style={{ padding: 18, marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Creator</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div className="miniCard" style={{ padding: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Hello crypto dealers and brokers 👋
            </div>

            <p style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.7 }}>
              I’m <b>Saharsh Koli</b>. I built CryptoPulse to make your decisions easier — especially
              when markets move fast and it’s hard to track everything manually.
              <br />
              <br />
              This app was designed to give you quick, readable signals so you can act faster with
              more clarity. If you find it helpful, I’d really appreciate your support and feedback
              so I can keep improving it.
            </p>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn" href="mailto:saharshkoli7007@gmail.com">
                Email
              </a>
              
              <a className="btn" href="tel:+15714283187">
                Call
              </a>
              <a className="btn" href="https://github.com/saharshkoli14" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a className="btn" href="https://saharshkoli14.github.io/" target="_blank" rel="noreferrer">
                Portfolio
              </a>
            </div>
          </div>

          <div className="miniCard" style={{ padding: 14 }}>
            <div className="miniLabel">Quick intro</div>
            <div className="miniValue" style={{ marginTop: 6, opacity: 0.92, lineHeight: 1.7 }}>
              I build data-driven products using Python, SQL, analytics, and machine learning.
              CryptoPulse is one of my projects focused on making information easier to use in real
              decision-making.
            </div>

            <div style={{ height: 12 }} />

            <div className="miniLabel">Links</div>
            <div className="miniValue" style={{ marginTop: 6, opacity: 0.92, lineHeight: 1.7 }}>
              • GitHub:{" "}
              <a
                href="https://github.com/saharshkoli14"
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline" }}
              >
                github.com/saharshkoli14
              </a>
              <br />
              • Portfolio:{" "}
              <a
                href="https://saharshkoli14.github.io/"
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline" }}
              >
                saharshkoli14.github.io
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 18, opacity: 0.75, fontSize: 12 }}>
        © {new Date().getFullYear()} CryptoPulse • Built for clarity, speed, and simple decision support.
      </footer>
    </main>
  );
}