import React, { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";
import { fmtMoney, fmtNumber } from "../utils/format";
import SpendByCategoryChart from "../components/charts/SpendByCategoryChart";
import MoneyInOutChart from "../components/charts/MoneyInOutChart";
import DailySpendTrendChart from "../components/charts/DailySpendTrendChart";


function Card({ title, value, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-100">{value}</div>
      {subtext ? <div className="mt-1 text-xs text-slate-400">{subtext}</div> : null}
    </div>
  );
}

function SectionShell({ title, right, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-slate-100">{title}</div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);

  const [error, setError] = useState(null);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [seedInfo, setSeedInfo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);


  async function refreshAll() {
    setError(null);

    const h = await dashboardApi.health();
    setHealth(h);

    const s = await dashboardApi.stats();
    setStats(s);

    if (s?.total_rows > 0) {
      const summaryRes = await dashboardApi.summary();
      setKpis(summaryRes?.kpis || null);

      const chartRes = await dashboardApi.charts();
      setCharts(chartRes?.charts || null);
    } else {
      setKpis(null);
      setCharts(null);
    }
  }

  async function handleSeed() {
    setLoadingSeed(true);
    setError(null);
    setSeedInfo(null);

    try {
      const seedRes = await dashboardApi.seed();

      setSeedInfo({
        at: new Date().toLocaleTimeString(),
        accounts: seedRes?.accounts_loaded || [],
        rows: seedRes?.total_rows || 0,
      });

      await refreshAll();
    } catch (e) {
      setError(e?.message || "Failed to seed demo data");
    } finally {
      setLoadingSeed(false);
    }
  }

  useEffect(() => {
    refreshAll().catch((e) => setError(e?.message || "Failed to load dashboard"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusPill = (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
      <span
        className={
          "h-2 w-2 rounded-full " + (health?.status === "online" ? "bg-emerald-400" : "bg-yellow-400")
        }
      />
      {health ? health.status : "loading"}
    </span>
  );

  const spendByCategory = charts?.spend_by_category_month || [];
  const inVsOut = charts?.in_vs_out_month || [];
  const dailyTrend = charts?.daily_spend_trend || [];

  const chartsData = charts?.charts ?? charts;


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Executive Dashboard</div>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
            <span>Backend</span>
            {statusPill}
          </div>
        </div>

        <button
          onClick={handleSeed}
          disabled={loadingSeed}
          className={
            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition " +
            (loadingSeed ? "cursor-not-allowed bg-slate-800 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-500")
          }
        >
          {loadingSeed ? "Loading..." : "Load Demo Data"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          <div className="font-bold">Error</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      {seedInfo ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-4 text-sm text-emerald-100">
          Seeded at {seedInfo.at}. Accounts: {seedInfo.accounts.join(", ")}. Rows loaded: {seedInfo.rows}.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <SectionShell title="Dataset">
            <div className="text-sm text-slate-300">
              {stats ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Rows</span>
                    <span className="font-semibold">{fmtNumber(stats.total_rows)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Accounts</span>
                    <span className="font-semibold">{stats.accounts_loaded?.join(", ")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Date range</span>
                    <span className="font-semibold">
                      {stats.date_min} to {stats.date_max}
                    </span>
                  </div>
                </div>
              ) : (
                "loading..."
              )}
            </div>
          </SectionShell>

          <SectionShell title="Narrative insight">
            <div className="text-sm text-slate-300">
              {kpis ? (
                <div className="space-y-2">
                  <div className="text-slate-400">Biggest driver this month</div>
                  <div className="text-lg font-extrabold">{kpis.biggest_spend_driver?.category || "N/A"}</div>
                  <div className="text-slate-300">
                    Change vs last month:{" "}
                    <span className="font-bold">{fmtMoney(kpis.biggest_spend_driver?.delta || 0)}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Next: click into category drilldowns and show top merchants.
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">Load demo data to generate insights.</div>
              )}
            </div>
          </SectionShell>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SectionShell title="KPIs (Month to Date)">
            {kpis ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card title="MTD Total Spend" value={fmtMoney(kpis.mtd_total_spend)} />
                <Card title="MTD Net Cashflow" value={fmtMoney(kpis.mtd_net_cashflow)} />
                <Card title="Recurring Total" value={fmtMoney(kpis.mtd_recurring_total)} subtext="Subscriptions category" />
                <Card title="Subscriptions Count" value={fmtNumber(kpis.subscriptions_count)} />
                <Card title="Anomalies" value={fmtNumber(kpis.anomalies_count_30d)} subtext="Last 30 days (demo rule)" />
                <Card
                  title="Biggest Spend Driver"
                  value={kpis.biggest_spend_driver?.category || "N/A"}
                  subtext={`Delta: ${fmtMoney(kpis.biggest_spend_driver?.delta || 0)}`}
                />
              </div>
            ) : (
              <div className="text-sm text-slate-400">No KPI data yet. Click Load Demo Data.</div>
            )}
          </SectionShell>
        </div>
      </div>

      <SectionShell title="Trends (from analytics engine)">
        {charts ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Spend by category (latest month)
              </div>

              <div className="mt-3">
              <SpendByCategoryChart
                data={spendByCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                }}
              />

              {selectedCategory ? (
                <div className="mt-3 text-xs text-slate-300">
                  Selected category: <span className="font-semibold text-white">{selectedCategory}</span>
                </div>
              ) : null}
              </div>
            </div>


            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Money in vs out (monthly)
              </div>

              <div className="mt-3">
                <MoneyInOutChart data={inVsOut.slice(-6)} />
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Bars show money in and money out. Line shows net cashflow.
              </div>
            </div>


            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Daily spend trend (latest 14d)
            </div>

            <div className="mt-3">
              <DailySpendTrendChart
                data={dailyTrend.slice(-14)}
                height={220}
              />
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Hover points to see day and spend.
            </div>
          </div>


          </div>
        ) : (
          <div className="text-sm text-slate-400">Load demo data to generate trends.</div>
        )}
      </SectionShell>
    </div>
  );
}
