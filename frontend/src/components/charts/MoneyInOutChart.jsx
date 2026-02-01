/**
 * Money In vs Money Out Chart
 * ---------------------------
 * This module renders a responsive composed chart that compares monthly money in, money out,
 * and net cashflow.
 *
 * What it renders:
 * - A Recharts ComposedChart with:
 *   - Bars for money_in and money_out
 *   - A line for net
 * - A custom tooltip that formats values using fmtMoney.
 * - A small empty state message when no data is provided.
 *
 * How it works:
 * - Accepts a data array of objects shaped like:
 *   { month: string, money_in: number, money_out: number, net: number }.
 * - Uses standard Recharts primitives (ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip).
 */ 

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
} from "recharts";
import { fmtMoney } from "../../utils/format";

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload.reduce((acc, p) => {
    acc[p.dataKey] = p.value;
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div className="mt-2 space-y-1 text-slate-200">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Money in</span>
          <span className="font-semibold">{fmtMoney(row.money_in || 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Money out</span>
          <span className="font-semibold">{fmtMoney(row.money_out || 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Net</span>
          <span className="font-semibold">{fmtMoney(row.net || 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MoneyInOutChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-slate-400">No chart data.</div>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <XAxis
            dataKey="month"
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
          />
          <YAxis
            tickFormatter={(v) => `$${Math.round(v)}`}
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.18)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.18)" }}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Bar
            dataKey="money_in"
            name="Money in"
            fill="rgba(255,255,255,0.85)"
            radius={[10, 10, 0, 0]}
          />
          <Bar
            dataKey="money_out"
            name="Money out"
            fill="rgba(255,255,255,0.35)"
            radius={[10, 10, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
