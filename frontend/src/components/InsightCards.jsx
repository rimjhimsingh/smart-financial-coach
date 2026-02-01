import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";

function Card({ title, metric, why, action, onDrilldown }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-xl font-extrabold text-white">{metric}</div>
      <div className="mt-2 text-sm text-slate-300">{why}</div>
      <div className="mt-3 text-sm font-semibold text-slate-200">{action}</div>
      <button
        onClick={onDrilldown}
        className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
      >
        View details
      </button>
    </div>
  );
}

export default function InsightCards({ month, onDrilldown }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorText("");
      try {
        const res = await dashboardApi.copilotInsights(month);
        const payload = res?.data ?? res;
        const nextCards = Array.isArray(payload?.cards) ? payload.cards : [];
        if (!mounted) return;
        setCards(nextCards.slice(0, 5));
      } catch (e) {
        if (!mounted) return;
        setCards([]);
        setErrorText(e?.message || "Failed to load insights");
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [month]);

  return (
    <div className="bg-transparent p-0">
      <div className="flex items-center justify-end">
        {loading ? <div className="text-xs text-slate-500">Generating...</div> : null}
      </div>

      {errorText ? <div className="mt-2 text-xs text-red-300">{errorText}</div> : null}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {cards.map((c, idx) => (
          <Card
            key={idx}
            title={c.title}
            metric={c.metric}
            why={c.why}
            action={c.action}
            onDrilldown={() => onDrilldown?.(c.drilldown)}
          />
        ))}

        {!loading && cards.length === 0 && !errorText ? (
          <div className="text-sm text-slate-400">No insights yet. Seed data and retry.</div>
        ) : null}
      </div>
    </div>
  );
}
