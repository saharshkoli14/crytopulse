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

import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

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

// Dark-theme chart styles (so axes/grid/tooltip are visible on your new background)
const AXIS_STROKE = "rgba(255,255,255,0.55)";
const TICK_FILL = "rgba(255,255,255,0.75)";
const GRID_STROKE = "rgba(255,255,255,0.10)";

const tooltipContentStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.75)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  color: "rgba(255,255,255,0.92)",
};

const tooltipLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
};

function tooltipNumberFormatter(value: ValueType, _name: NameType): [string, string] {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return [fmtNum(Number.isFinite(num) ? num : null), ""];
}

export default function OverviewCharts({ series }: { series: Point[] }) {
  const data = (series ?? []).map((p) => ({
    ...p,
    t: fmtTime(p.bucket),
  }));

  return (
    <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
      {/* Market Index */}
      <div
        className="glass"
        style={{
          padding: 14,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Market Index (base=100)</h3>

        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />

              <XAxis
                dataKey="t"
                minTickGap={30}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <YAxis
                tickFormatter={(v) => String(Math.round(v))}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <Tooltip
                formatter={tooltipNumberFormatter}
                labelFormatter={(label) => `Time: ${label}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
              />

              {/* Let the theme decide the line color; keep it visible with a thicker stroke */}
              <Line type="monotone" dataKey="market_index" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Total Volume */}
      <div className="glass" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Total Volume (per minute)</h3>

        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />

              <XAxis
                dataKey="t"
                minTickGap={30}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <YAxis
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <Tooltip
                formatter={tooltipNumberFormatter}                
                labelFormatter={(label) => `Time: ${label}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
              />

              {/* Bar with a visible fill on dark background */}
              <Bar dataKey="total_volume" fill="rgba(99,102,241,0.65)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}