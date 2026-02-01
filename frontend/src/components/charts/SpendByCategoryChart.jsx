import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fmtMoney } from "../../utils/format";

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const v = payload[0].value ?? 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow">
      <div className="font-semibold">{label}</div>
      <div className="mt-1 text-slate-300">{fmtMoney(v)}</div>
    </div>
  );
}

export default function SpendByCategoryChart({ data, onSelectCategory }) {
  const safe = (data || []).map((d) => ({
    ...d,
    value: Number(d.value || 0),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safe} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.25)" strokeDasharray="3 3" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: "rgba(226,232,240,0.85)" }}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.25)" }}
            interval={0}
            angle={-18}
            height={55}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "rgba(226,232,240,0.85)" }}
            axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
            tickLine={{ stroke: "rgba(148,163,184,0.25)" }}
            tickFormatter={(v) => `$${Math.round(v)}`}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(148,163,184,0.10)" }} />
          <Bar
            dataKey="value"
            fill="rgba(255,255,255,0.92)"
            radius={[10, 10, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(_, idx) => {
              const row = typeof idx === "number" ? safe[idx] : null;
              const category = row?.category;
              if (category && onSelectCategory) onSelectCategory(category);
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      
    </div>
  );
}
