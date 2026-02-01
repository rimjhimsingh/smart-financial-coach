/**
 * Subscriptions Page
 * ------------------
 * This module renders the recurring charges view that helps users identify subscriptions and gray charges.
 *
 * What it renders:
 * - A page header with a refresh action.
 * - Filter controls to narrow results by merchant name, cadence type, and minimum confidence.
 * - A results table showing merchant, cadence, average charge, annualized cost, confidence score,
 *   and flags such as trial to paid and price increase.
 *
 * How it works:
 * - Fetches recurring merchant detections from the backend via dashboardApi.subscriptions.
 * - Stores results in component state and derives a filtered list using useMemo to keep rendering fast.
 * - Provides a small Badge component for consistent flag styling and a local fmtMoney helper for display.
 */


import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
      {children}
    </span>
  );
}

function fmtMoney(n) {
  const val = Number(n || 0);
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  return `${sign}$${abs.toFixed(2)}`;
}

export default function Subscriptions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [cadence, setCadence] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0.0);

  async function load() {
    setLoading(true);
    try {
      const res = await dashboardApi.subscriptions(2);
      setRows(res?.subscriptions || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (rows || [])
      .filter((r) => {
        if (!q) return true;
        return String(r.merchant || "").toLowerCase().includes(q);
      })
      .filter((r) => {
        if (cadence === "all") return true;
        return r.cadence === cadence;
      })
      .filter((r) => {
        return Number(r.confidence || 0) >= minConfidence;
      });
  }, [rows, query, cadence, minConfidence]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xl font-extrabold text-white">Recurring charges</div>
          <div className="mt-1 text-sm text-slate-400">
            Detected recurring merchants across your accounts. Flags highlight gray charges.
          </div>
        </div>

        <button
          onClick={load}
          className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Search</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Merchant name"
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cadence</div>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">All</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Minimum confidence
          </div>
          <div className="mt-2 flex items-center justify-between">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full"
            />
            <div className="ml-3 w-12 text-right text-sm font-semibold text-slate-200">
              {minConfidence.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            Results ({filtered.length})
          </div>
          {loading ? <div className="text-xs text-slate-400">Loading...</div> : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Merchant</th>
                <th className="py-2 pr-4">Cadence</th>
                <th className="py-2 pr-4">Avg</th>
                <th className="py-2 pr-4">Annual</th>
                <th className="py-2 pr-4">Confidence</th>
                <th className="py-2 pr-2">Flags</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {filtered.map((r) => {
                const flags = r.flags || {};
                return (
                  <tr key={`${r.merchant}-${r.cadence}-${r.last_charged_date}`} className="border-t border-slate-800">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-white">{r.merchant}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Last charged: {r.last_charged_date}  Occurrences: {r.occurrences_count}
                      </div>
                    </td>
                    <td className="py-3 pr-4">{r.cadence}</td>
                    <td className="py-3 pr-4">{fmtMoney(r.avg_amount)}</td>
                    <td className="py-3 pr-4 font-semibold">{fmtMoney(r.annualized_cost)}</td>
                    <td className="py-3 pr-4">{Number(r.confidence || 0).toFixed(2)}</td>
                    <td className="py-3 pr-2">
                      <div className="flex flex-wrap gap-2">
                        {flags.trial_to_paid ? <Badge>Trial to paid</Badge> : null}
                        {flags.price_increase ? <Badge>Price increase</Badge> : null}
                        {!flags.trial_to_paid && !flags.price_increase ? (
                          <span className="text-xs text-slate-500">None</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-sm text-slate-400">
                    No recurring charges matched your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
