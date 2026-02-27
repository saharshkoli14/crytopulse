"use client";

import React from "react";
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
import type {
  NameType,
  ValueType,
  Payload,
} from "recharts/types/component/DefaultTooltipContent";

type Point = {
  bucket: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

function toLocalTimeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtNum(x: unknown, maxFrac = 2) {
  if (x === null || x === undefined) return "—";
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return "—";
  return Intl.NumberFormat("en-US", { maximumFractionDigits: maxFrac }).format(n);
}

// Dark-theme chart styles for visibility
const AXIS_STROKE = "rgba(255,255,255,0.55)";
const TICK_FILL = "rgba(255,255,255,0.78)";
const GRID_STROKE = "rgba(255,255,255,0.12)";

const tooltipContentStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.78)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  color: "rgba(255,255,255,0.92)",
};

const tooltipLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
};

// Recharts Tooltip formatter signature (strict)
type TooltipFormatter = (
  value: ValueType | undefined,
  name: string,
  item: Payload<ValueType, string>,
  index: number,
  payload: Array<Payload<ValueType, string>>
) => React.ReactNode | [React.ReactNode, string];

function toNumber(v: ValueType | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const tooltipValueFormatter: TooltipFormatter = (value, name) => {
  const n = toNumber(value);
  const pretty = n === null ? "—" : fmtNum(n, 2);
  return [pretty, name];
};

const tooltipVolumeFormatter: TooltipFormatter = (value, name) => {
  const n = toNumber(value);
  const pretty =
    n === null ? "—" : Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return [pretty, name];
};

export default function SymbolCharts({ points }: { points: Point[] }) {
  // Keep charts smooth by downsampling if you have 1440 points
  const step = points.length > 600 ? Math.ceil(points.length / 600) : 1;
  const data = points.filter((_, i) => i % step === 0);

  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 10 }}>Price (close) — last 24h</h3>

      <div className="glass" style={{ padding: 12 }}>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />

              <XAxis
                dataKey="bucket"
                tickFormatter={toLocalTimeLabel}
                minTickGap={24}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => fmtNum(v, 2)}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                labelFormatter={(l: NameType) => new Date(String(l)).toLocaleString()}
                formatter={tooltipValueFormatter}
              />

              <Line
                type="monotone"
                dataKey="close"
                dot={false}
                stroke="rgba(96,165,250,0.95)"
                strokeWidth={2.25}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 10 }}>Volume — last 24h</h3>

      <div className="glass" style={{ padding: 12 }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />

              <XAxis
                dataKey="bucket"
                tickFormatter={toLocalTimeLabel}
                minTickGap={24}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <YAxis
                tickFormatter={(v) => fmtNum(v, 0)}
                stroke={AXIS_STROKE}
                tick={{ fill: TICK_FILL, fontSize: 12 }}
                tickLine={{ stroke: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
              />

              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                labelFormatter={(l: NameType) => new Date(String(l)).toLocaleString()}
                formatter={tooltipVolumeFormatter}
              />

              <Bar dataKey="volume" isAnimationActive={false} fill="rgba(99,102,241,0.65)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}