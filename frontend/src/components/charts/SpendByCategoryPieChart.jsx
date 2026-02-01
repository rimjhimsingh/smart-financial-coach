import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { fmtMoney } from "../../utils/format";

function PieMoneyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow">
      <div className="font-semibold">{p.name}</div>
      <div className="mt-1 text-slate-300">{fmtMoney(p.value)}</div>
    </div>
  );
}

export default function SpendByCategoryPieChart({ data }) {
  const safe = (data || [])
    .map((d) => ({
      name: d.category,
      value: Number(d.value || 0),
    }))
    .filter((d) => d.value > 0);

  // Gray and white aesthetic like your other charts
  const COLORS = [
    "rgba(255,255,255,0.92)",
    "rgba(255,255,255,0.78)",
    "rgba(255,255,255,0.66)",
    "rgba(255,255,255,0.54)",
    "rgba(255,255,255,0.44)",
    "rgba(255,255,255,0.36)",
    "rgba(255,255,255,0.30)",
    "rgba(255,255,255,0.25)",
    "rgba(255,255,255,0.20)",
    "rgba(255,255,255,0.16)",
    "rgba(255,255,255,0.13)",
    "rgba(255,255,255,0.10)",
  ];

  if (!safe.length) {
    return <div className="text-sm text-slate-400">No category spend to display.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safe}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={2}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={1}
          >
            {safe.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip content={<PieMoneyTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "rgba(226,232,240,0.85)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
