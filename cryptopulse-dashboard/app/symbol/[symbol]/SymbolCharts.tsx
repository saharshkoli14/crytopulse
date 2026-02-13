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

export default function SymbolCharts({ points }: { points: Point[] }) {
  // Keep charts smooth by downsampling if you have 1440 points
  const step = points.length > 600 ? Math.ceil(points.length / 600) : 1;
  const data = points.filter((_, i) => i % step === 0);

  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 10 }}>Price (close) — last 24h</h3>

      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={toLocalTimeLabel}
                minTickGap={24}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) =>
                  Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)
                }
              />
              <Tooltip
                labelFormatter={(l) => new Date(l).toLocaleString()}
                formatter={(value: any, name: any) => [value, name]}
              />
              <Line
                type="monotone"
                dataKey="close"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 10 }}>Volume — last 24h</h3>

      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={toLocalTimeLabel}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) =>
                  Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
                }
              />
              <Tooltip
                labelFormatter={(l) => new Date(l).toLocaleString()}
                formatter={(value: any, name: any) => [value, name]}
              />
              <Bar dataKey="volume" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
