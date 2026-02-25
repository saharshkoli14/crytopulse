"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "A" | "D";
type Confidence = "LOW" | "MED" | "HIGH";

type ModelMetrics = {
  auc_mean?: number;
  prauc_mean?: number;
  prauc_baseline?: number;
  positive_rate?: number;
};

type PredictSuccessA = {
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

type PredictSuccessD = {
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

type PredictError = {
  ok: false;
  error: string;
  // allow backend to send extra debug fields safely (no `any`)
  details?: unknown;
  raw?: unknown;
};

type PredictResponse = PredictSuccessA | PredictSuccessD | PredictError;

function pct(x: number) {
  return `${(x * 100).toFixed(2)}%`;
}

function isPredictResponse(x: unknown): x is PredictResponse {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return typeof obj.ok === "boolean";
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Fetch failed";
}

export default function PredictPanel({
  defaultSymbol = "BTCUSD",
}: {
  defaultSymbol?: string;
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [mode, setMode] = useState<Mode>("D");
  const [horizon, setHorizon] = useState(60);
  const [thr, setThr] = useState(0.0035);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshSec, setRefreshSec] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const requestUrl = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set("mode", mode);
    qp.set("horizon", String(horizon));
    if (mode === "D") qp.set("thr", String(thr));
    return `/api/predict/${encodeURIComponent(symbol)}?${qp.toString()}`;
  }, [symbol, mode, horizon, thr]);

  const fetchPredict = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });

      const jsonUnknown: unknown = await res.json().catch(() => null);

      if (!isPredictResponse(jsonUnknown)) {
        setData({ ok: false, error: "Invalid API response shape", raw: jsonUnknown });
        setErr("Invalid API response shape");
        return;
      }

      setData(jsonUnknown);

      if (!res.ok) {
        setErr(
          jsonUnknown.ok === false
            ? jsonUnknown.error
            : `Request failed (${res.status} ${res.statusText})`
        );
        return;
      }

      if (jsonUnknown.ok !== true) {
        setErr(jsonUnknown.error ?? "Unknown API error");
        return;
      }

      setLastUpdated(new Date().toLocaleString());
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [requestUrl]);

  useEffect(() => {
    fetchPredict();
    return () => abortRef.current?.abort();
  }, [fetchPredict]);

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Math.max(5, refreshSec) * 1000;
    const id = setInterval(fetchPredict, ms);
    return () => clearInterval(id);
  }, [autoRefresh, refreshSec, fetchPredict]);

  const badge = (text: string, tone: "green" | "red" | "gray" | "blue") => {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
    const map: Record<typeof tone, string> = {
      green: "bg-green-100 text-green-800",
      red: "bg-red-100 text-red-800",
      gray: "bg-gray-100 text-gray-800",
      blue: "bg-blue-100 text-blue-800",
    };
    return <span className={`${base} ${map[tone]}`}>{text}</span>;
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">🔮 Prediction</div>
          <div className="text-sm text-gray-500">
            Interactive model run (A = direction, D = strong-up signal)
          </div>
          {lastUpdated && (
            <div className="mt-1 text-xs text-gray-400">
              Last updated: {lastUpdated}
            </div>
          )}
        </div>

        <button
          onClick={fetchPredict}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Running..." : "Run now"}
        </button>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border p-3">
          <label className="text-xs text-gray-500">Symbol</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="BTCUSD">BTCUSD</option>
            <option value="ETHUSD">ETHUSD</option>
            <option value="SOLUSD">SOLUSD</option>
          </select>
        </div>

        <div className="rounded-xl border p-3">
          <label className="text-xs text-gray-500">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="D">D — Strong UP move</option>
            <option value="A">A — Direction (UP/DOWN)</option>
          </select>
        </div>

        <div className="rounded-xl border p-3">
          <label className="text-xs text-gray-500">Horizon (minutes)</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            {[15, 30, 60, 120].map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border p-3">
          <label className="text-xs text-gray-500">Threshold (D only)</label>
          <select
            value={thr}
            onChange={(e) => setThr(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            disabled={mode !== "D"}
          >
            <option value={0.0025}>0.25%</option>
            <option value={0.0035}>0.35% (recommended)</option>
            <option value={0.0040}>0.40%</option>
            <option value={0.0050}>0.50% (high conviction)</option>
          </select>
        </div>
      </div>

      {/* Auto-refresh */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-4 w-4"
          />
          Auto refresh
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Every</span>
          <input
            type="number"
            min={5}
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value))}
            className="w-20 rounded-lg border px-2 py-1 text-sm"
            disabled={!autoRefresh}
          />
          <span className="text-xs text-gray-500">sec</span>
        </div>

        <div className="ml-auto text-xs text-gray-500 break-all">{requestUrl}</div>
      </div>

      {/* Result */}
      <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
        {err && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            ❌ {err}
          </div>
        )}

        {!data ? (
          <div className="text-sm text-gray-500">No result yet.</div>
        ) : data.ok === false ? (
          <pre className="overflow-auto rounded-lg bg-white p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : data.mode === "D" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {badge("D: Strong UP", "blue")}
              {badge(data.signal, data.signal === "STRONG_UP" ? "green" : "gray")}
              {badge(
                `Confidence: ${data.confidence}`,
                data.confidence === "HIGH"
                  ? "green"
                  : data.confidence === "MED"
                  ? "blue"
                  : "gray"
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Prob strong UP</div>
                <div className="text-2xl font-semibold">{pct(data.prob_strong_up)}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">As of (bucket)</div>
                <div className="text-sm font-medium break-all">{data.asof_bucket}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">As of close</div>
                <div className="text-2xl font-semibold">
                  {Number(data.asof_close).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="font-semibold">Model metrics</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600 md:grid-cols-4">
                <div>AUC: {Number(data.model_metrics?.auc_mean ?? 0).toFixed(3)}</div>
                <div>PR-AUC: {Number(data.model_metrics?.prauc_mean ?? 0).toFixed(3)}</div>
                <div>Baseline: {Number(data.model_metrics?.prauc_baseline ?? 0).toFixed(3)}</div>
                <div>Pos rate: {Number(data.model_metrics?.positive_rate ?? 0).toFixed(3)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {badge("A: Direction", "blue")}
              {badge(data.direction, data.direction === "UP" ? "green" : "red")}
              {badge(
                `Confidence: ${data.confidence}`,
                data.confidence === "HIGH"
                  ? "green"
                  : data.confidence === "MED"
                  ? "blue"
                  : "gray"
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Prob UP</div>
                <div className="text-2xl font-semibold">{pct(data.prob_up)}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">As of (bucket)</div>
                <div className="text-sm font-medium break-all">{data.asof_bucket}</div>
              </div>
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">As of close</div>
                <div className="text-2xl font-semibold">
                  {Number(data.asof_close).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="font-semibold">Model metrics</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600 md:grid-cols-3">
                <div>AUC: {Number(data.model_metrics?.auc_mean ?? 0).toFixed(3)}</div>
                <div>PR-AUC: {Number(data.model_metrics?.prauc_mean ?? 0).toFixed(3)}</div>
                <div>Baseline: {Number(data.model_metrics?.prauc_baseline ?? 0).toFixed(3)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3">
          <details className="rounded-xl bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium">Raw JSON</summary>
            <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}