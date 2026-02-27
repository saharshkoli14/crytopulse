"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "A" | "D";
type Confidence = "LOW" | "MED" | "HIGH";

type ModelMetrics = Record<string, unknown>;

type PredictOkA = {
  ok: true;
  symbol: string;
  horizon_minutes: number;
  mode: "A";
  asof_bucket: string;
  asof_close: number;
  prob_up: number;
  direction: "UP" | "DOWN";
  confidence: Confidence;
  model_metrics?: ModelMetrics;
};

type PredictOkD = {
  ok: true;
  symbol: string;
  horizon_minutes: number;
  mode: "D";
  thr: number;
  asof_bucket: string;
  asof_close: number;
  prob_strong_up: number;
  signal: "STRONG_UP" | "NO_SIGNAL";
  confidence: Confidence;
  model_metrics?: ModelMetrics;
};

type PredictErr = { ok: false; error: string; [k: string]: unknown };
type PredictResponse = PredictOkA | PredictOkD | PredictErr;

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function confidenceLabel(c: Confidence) {
  if (c === "HIGH") return { text: "High confidence", hint: "Stronger signal (still not guaranteed)" };
  if (c === "MED") return { text: "Medium confidence", hint: "Some signal, treat carefully" };
  return { text: "Low confidence", hint: "Weak/unclear signal" };
}

function toneForConfidence(c: Confidence) {
  return c === "HIGH"
    ? "rgba(34,197,94,0.95)"
    : c === "MED"
      ? "rgba(59,130,246,0.95)"
      : "rgba(148,163,184,0.95)";
}

function cardBorderForConfidence(c: Confidence) {
  return c === "HIGH"
    ? "2px solid rgba(34,197,94,0.55)"
    : c === "MED"
      ? "2px solid rgba(59,130,246,0.55)"
      : "2px solid rgba(148,163,184,0.45)";
}

function explainA(direction: "UP" | "DOWN", probUp: number) {
  if (direction === "UP") {
    return probUp >= 0.6 ? "Model leans upward for the selected time window." : "Slight lean upward, but it’s not strong.";
  }
  return probUp <= 0.4 ? "Model leans downward for the selected time window." : "Slight lean downward, but it’s not strong.";
}

function explainD(signal: "STRONG_UP" | "NO_SIGNAL", _p: number, thr: number) {
  const t = (thr * 100).toFixed(2);
  if (signal === "STRONG_UP") return `Possible strong upward move (≥ ${t}%) in the chosen time window.`;
  return `No strong upward signal (≥ ${t}%) right now.`;
}

const glassPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
};

const inputStyle: React.CSSProperties = {
  marginTop: 6,
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(99,102,241,0.35)",
  border: "1px solid rgba(99,102,241,0.55)",
};

function metricNumber(metrics: ModelMetrics | undefined, key: string, fallback = 0): number {
  const v = metrics?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Simple tooltip icon + bubble */
function InfoTip({ text }: { text: string }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 8,
      }}
      title={text} // fallback tooltip
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          cursor: "help",
          userSelect: "none",
          color: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(255,255,255,0.20)",
          background: "rgba(0,0,0,0.25)",
        }}
        aria-label="Info"
      >
        i
      </span>

      {/* bubble (CSS-only hover) */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 26,
          width: 260,
          padding: "10px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.80)",
          color: "rgba(255,255,255,0.92)",
          fontSize: 12,
          lineHeight: 1.35,
          boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
          opacity: 0,
          transform: "translateY(-4px)",
          pointerEvents: "none",
          transition: "opacity 120ms ease, transform 120ms ease",
          zIndex: 50,
        }}
        className="infotip-bubble"
      >
        {text}
      </span>

      <style jsx>{`
        span[title] .infotip-bubble {
          display: block;
        }
        span[title]:hover .infotip-bubble {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </span>
  );
}

export default function SimplePredict() {
  const [symbol, setSymbol] = useState("BTCUSD");
  const [mode, setMode] = useState<Mode>("D");
  const [horizon, setHorizon] = useState(60);
  const [thr, setThr] = useState(0.0035);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const url = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set("mode", mode);
    qp.set("horizon", String(horizon));
    if (mode === "D") qp.set("thr", String(thr));
    return `/api/predict/${encodeURIComponent(symbol)}?${qp.toString()}`;
  }, [symbol, mode, horizon, thr]);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as PredictResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26 }}>Prediction</h1>
        <p style={{ marginTop: 6, opacity: 0.78 }}>
          Simple signal for everyday users. You can open details if you want.
        </p>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{ ...primaryButtonStyle, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Running..." : "Run prediction"}
      </button>
    </div>
  );

  const controls = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginTop: 14,
      }}
    >
      <div style={{ ...glassPanel, padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center" }}>
          Coin
          <InfoTip text="Choose the cryptocurrency pair you want to check. (BTCUSD, ETHUSD, SOLUSD)" />
        </div>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={inputStyle}>
          <option value="BTCUSD">BTCUSD</option>
          <option value="ETHUSD">ETHUSD</option>
          <option value="SOLUSD">SOLUSD</option>
        </select>
      </div>

      <div style={{ ...glassPanel, padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center" }}>
          Prediction type
          <InfoTip text="Strong move (D): checks if a strong UP move is likely (above your threshold). Direction (A): basic UP vs DOWN direction." />
        </div>
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={inputStyle}>
          <option value="D">Strong move (signal)</option>
          <option value="A">Direction (up/down)</option>
        </select>
      </div>

      <div style={{ ...glassPanel, padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center" }}>
          Time window
          <InfoTip text="How far ahead the prediction looks. Example: 60 minutes means the model is estimating what could happen within the next 60 minutes." />
        </div>
        <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={inputStyle}>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>60 minutes</option>
          <option value={120}>120 minutes</option>
        </select>
      </div>

      <div style={{ ...glassPanel, padding: 12, opacity: mode === "D" ? 1 : 0.55 }}>
        <div style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center" }}>
          Signal strength (D only)
          <InfoTip text="Only for Strong move (D). Higher threshold = fewer signals but stronger moves. 0.35% is a balanced setting." />
        </div>
        <select
          disabled={mode !== "D"}
          value={thr}
          onChange={(e) => setThr(Number(e.target.value))}
          style={{ ...inputStyle, cursor: mode === "D" ? "pointer" : "not-allowed" }}
        >
          <option value={0.0025}>0.25% (more frequent)</option>
          <option value={0.0035}>0.35% (recommended)</option>
          <option value={0.0040}>0.40% (stronger)</option>
          <option value={0.0050}>0.50% (high conviction)</option>
        </select>
      </div>
    </div>
  );

  const detailsPreStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    overflow: "auto",
    padding: 12,
    background: "rgba(0,0,0,0.30)",
    color: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
  };

  const explanationBoxStyle: React.CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const result = (() => {
    if (!data) {
      return (
        <div style={{ marginTop: 16, ...glassPanel, padding: 14 }}>
          No result yet.
        </div>
      );
    }

    if (data.ok === false) {
      return (
        <div style={{ marginTop: 16, border: "2px solid rgba(239,68,68,0.65)", borderRadius: 16, padding: 16, ...glassPanel }}>
          <div style={{ fontWeight: 800, color: "rgba(248,113,113,0.98)" }}>⚠ {data.error}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
            If you see “Model not trained”, run the shown training command.
          </div>

          <button onClick={() => setShowDetails((v) => !v)} style={{ ...buttonStyle, marginTop: 12 }}>
            {showDetails ? "Hide details" : "Show details"}
          </button>

          {showDetails && <pre style={detailsPreStyle}>{JSON.stringify(data, null, 2)}</pre>}
        </div>
      );
    }

    if (data.mode === "A") {
      const conf = confidenceLabel(data.confidence);
      const headline = data.direction === "UP" ? "📈 Likely UP" : "📉 Likely DOWN";
      const explanation = explainA(data.direction, data.prob_up);

      const auc = metricNumber(data.model_metrics, "auc_mean", 0);
      const prauc = metricNumber(data.model_metrics, "prauc_mean", 0);
      const baseline = metricNumber(data.model_metrics, "prauc_baseline", 0);

      return (
        <div
          style={{
            marginTop: 16,
            borderRadius: 16,
            padding: 16,
            border: cardBorderForConfidence(data.confidence),
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.78 }}>
                {data.symbol} • {data.horizon_minutes} min • Direction
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{headline}</div>
              <div style={{ marginTop: 6, color: toneForConfidence(data.confidence), fontWeight: 800 }}>
                {conf.text}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{conf.hint}</div>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, opacity: 0.78 }}>Chance of UP</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>{pct(data.prob_up)}</div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>As of</div>
              <div style={{ fontSize: 13 }}>{new Date(data.asof_bucket).toLocaleString()}</div>
            </div>
          </div>

          <div style={explanationBoxStyle}>
            <div style={{ fontWeight: 800 }}>Plain explanation</div>
            <div style={{ marginTop: 6, opacity: 0.92 }}>{explanation}</div>
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Price now: <b>{data.asof_close.toFixed(2)}</b>
            </div>

            <button onClick={() => setShowDetails((v) => !v)} style={buttonStyle}>
              {showDetails ? "Hide technical details" : "Show technical details"}
            </button>
          </div>

          {showDetails && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800 }}>Model metrics</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                AUC: {auc.toFixed(3)} • PR-AUC: {prauc.toFixed(3)} • Baseline: {baseline.toFixed(3)}
              </div>
              <pre style={detailsPreStyle}>{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>
      );
    }

    const conf = confidenceLabel(data.confidence);
    const headline = data.signal === "STRONG_UP" ? "🚀 Strong UP signal" : "🟡 No strong signal";
    const explanation = explainD(data.signal, data.prob_strong_up, data.thr);

    const auc = metricNumber(data.model_metrics, "auc_mean", 0);
    const prauc = metricNumber(data.model_metrics, "prauc_mean", 0);
    const baseline = metricNumber(data.model_metrics, "prauc_baseline", 0);
    const posRate = metricNumber(data.model_metrics, "positive_rate", 0);

    return (
      <div
        style={{
          marginTop: 16,
          borderRadius: 16,
          padding: 16,
          border: cardBorderForConfidence(data.confidence),
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>
              {data.symbol} • {data.horizon_minutes} min • Strong move signal
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{headline}</div>
            <div style={{ marginTop: 6, color: toneForConfidence(data.confidence), fontWeight: 800 }}>
              {conf.text}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{conf.hint}</div>
          </div>

          <div style={{ minWidth: 240 }}>
            <div style={{ fontSize: 12, opacity: 0.78 }}>Chance of strong UP</div>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{pct(data.prob_strong_up)}</div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>As of</div>
            <div style={{ fontSize: 13 }}>{new Date(data.asof_bucket).toLocaleString()}</div>
          </div>
        </div>

        <div style={explanationBoxStyle}>
          <div style={{ fontWeight: 800 }}>Plain explanation</div>
          <div style={{ marginTop: 6, opacity: 0.92 }}>{explanation}</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Price now: <b>{data.asof_close.toFixed(2)}</b> • Threshold: <b>{(data.thr * 100).toFixed(2)}%</b>
          </div>

          <button onClick={() => setShowDetails((v) => !v)} style={buttonStyle}>
            {showDetails ? "Hide technical details" : "Show technical details"}
          </button>
        </div>

        {showDetails && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>Model metrics</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              AUC: {auc.toFixed(3)} • PR-AUC: {prauc.toFixed(3)} • Baseline: {baseline.toFixed(3)} • Pos rate:{" "}
              {posRate.toFixed(3)}
            </div>
            <pre style={detailsPreStyle}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  })();

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {header}
      {controls}
      {result}
    </div>
  );
}