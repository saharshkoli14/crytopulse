"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

type Point = {
  bucket: string;
  market_index: number | null;
  total_volume: number | null;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtNum(x: number | null | undefined) {
  if (x === null || x === undefined) return "—";
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);
}

export default function OverviewCharts({ series }: { series: Point[] }) {
  const data = (series ?? []).map((p) => ({
    ...p,
    t: fmtTime(p.bucket),
  }));

  return (
    <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Market Index (base=100)</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" minTickGap={30} />
              <YAxis tickFormatter={(v) => String(Math.round(v))} />
              <Tooltip
                formatter={(v: any) => fmtNum(typeof v === "number" ? v : Number(v))}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line type="monotone" dataKey="market_index" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Total Volume (per minute)</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" minTickGap={30} />
              <YAxis />
              <Tooltip
                formatter={(v: any) => fmtNum(typeof v === "number" ? v : Number(v))}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Bar dataKey="total_volume" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
