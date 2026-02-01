/**
 * Daily Spend Trend Chart
 * -----------------------
 * This module renders a responsive line chart for daily spending over a recent window.
 *
 * What it renders:
 * - A Recharts LineChart showing spend per day.
 * - A custom tooltip that formats spend using the shared fmtMoney helper.
 * - A small empty state message when no data is available.
 *
 * How it works:
 * - Accepts a data array of objects shaped like { day: string, spend: number }.
 * - Slices to the last maxPoints entries to keep the chart readable.
 * - Uses Recharts components (ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line).
 */

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { fmtMoney } from "../../utils/format";

function SpendTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const v = payload[0]?.value ?? 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-6">
        <span className="text-slate-400">Spend</span>
        <span className="font-semibold">{fmtMoney(v)}</span>
      </div>
    </div>
  );
}

export default function DailySpendTrendChart({ data = [], maxPoints = 14 }) {
  const rows = Array.isArray(data) ? data.slice(-maxPoints) : [];

  if (rows.length === 0) {
    return <div className="text-sm text-slate-400">No chart data.</div>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `$${Math.round(v)}`}
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
          />
          <Tooltip content={<SpendTooltip />} />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
