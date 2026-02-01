import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "../api/dashboardApi";
import { fmtMoney, fmtNumber } from "../utils/format";
import SpendByCategoryChart from "../components/charts/SpendByCategoryChart";
import MoneyInOutChart from "../components/charts/MoneyInOutChart";
import DailySpendTrendChart from "../components/charts/DailySpendTrendChart";
import InsightCards from "../components/InsightCards";

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
  const navigate = useNavigate();

  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);

  const [error, setError] = useState(null);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [seedInfo, setSeedInfo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [monthlyDeltaData, setMonthlyDeltaData] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState(null);
  const [anomalies, setAnomalies] = useState(null);

  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);

  async function refreshAll(monthOverride) {
    setError(null);

    const h = await dashboardApi.health();
    setHealth(h);

    const s = await dashboardApi.stats();
    setStats(s);

    if (s?.total_rows > 0) {
      const summaryRes = await dashboardApi.summary();
      setKpis(summaryRes?.kpis || null);

      const chartRes = await dashboardApi.charts(monthOverride || selectedMonth);
      const c = chartRes?.charts || null;
      setCharts(c);

      const months = c?.available_months || (c?.in_vs_out_month || []).map((x) => x.month);
      setAvailableMonths(months);

      const resolved = c?.month || (months.length ? months[months.length - 1] : null);
      if (!selectedMonth && resolved) setSelectedMonth(resolved);

      await refreshInsights(resolved);
    } else {
      setKpis(null);
      setCharts(null);
      setAvailableMonths([]);
      setSelectedMonth(null);
      setMonthlyDeltaData(null);
      setCategoryBreakdown(null);
      setAnomalies(null);
    }
  }

  async function refreshInsights(month) {
    if (!month) return;

    setLoadingInsights(true);
    setLoadingAnomalies(true);

    try {
      const deltas = await dashboardApi.monthlyDeltas(month, 3, 5);
      setMonthlyDeltaData(deltas || null);
    } catch (e) {
      setMonthlyDeltaData(null);
    } finally {
      setLoadingInsights(false);
    }

    try {
      const a = await dashboardApi.anomalies(30, 5);
      setAnomalies(a || null);
    } catch (e) {
      setAnomalies(null);
    } finally {
      setLoadingAnomalies(false);
    }
  }

  async function loadCategoryBreakdown(month, category) {
    if (!category) return;
    setLoadingDrilldown(true);
    try {
      const data = await dashboardApi.categoryBreakdown(month, category, 10, 10);
      setCategoryBreakdown(data || null);
    } catch (e) {
      setCategoryBreakdown(null);
    } finally {
      setLoadingDrilldown(false);
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
  }, []);

  const statusPill = (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate கொள்ள text-slate-300">
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

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={loadingSeed}
            className={
              "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition " +
              (loadingSeed
                ? "cursor-not-allowed bg-slate-800 text-slate-400"
                : "bg-blue-600 text-white hover:bg-blue-500")
            }
          >
            {loadingSeed ? "Loading..." : "Load Demo Data"}
          </button>

          {availableMonths?.length ? (
            <select
              value={selectedMonth || ""}
              onChange={async (e) => {
                const m = e.target.value;
                setSelectedMonth(m);
                setSelectedCategory(null);
                setCategoryBreakdown(null);
                await refreshAll(m);
              }}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : null}
        </div>
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

          <SectionShell title="Executive insight">
            {!kpis ? (
              <div className="text-slate-400">Load demo data to generate insights.</div>
            ) : loadingInsights ? (
              <div className="text-sm text-slate-400">Loading insights...</div>
            ) : (
              <div className="space-y-4 text-sm text-slate-200">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    What changed this month
                  </div>
                  <div className="mt-2 space-y-3">
                    {(monthlyDeltaData?.top_category_increases || []).map((c) => (
                      <div key={c.category} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-bold">{c.category}</div>
                          <div className="text-slate-300">{fmtMoney(c.delta)}</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Top drivers</div>
                        <div className="mt-1 space-y-1">
                          {(c.top_merchants || []).slice(0, 3).map((m) => (
                            <div key={m.merchant} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{m.merchant}</span>
                              <span className="text-slate-200">{fmtMoney(m.delta)}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCategory(c.category);
                            loadCategoryBreakdown(selectedMonth, c.category);
                          }}
                          className="mt-2 text-xs font-semibold text-blue-300 hover:text-blue-200"
                        >
                          View transactions
                        </button>
                      </div>
                    ))}
                    {!monthlyDeltaData?.top_category_increases?.length ? (
                      <div className="text-xs text-slate-400">
                        Not enough history for month over month comparisons.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Biggest spend driver</div>
                  <div className="mt-1 text-base font-extrabold">
                    {kpis.biggest_spend_driver?.category || "N/A"}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Change vs last month:{" "}
                    <span className="font-bold">{fmtMoney(kpis.biggest_spend_driver?.delta || 0)}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Anomalies (last 30 days)
                  </div>
                  {loadingAnomalies ? (
                    <div className="mt-2 text-xs text-slate-400">Loading...</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {(anomalies?.anomalies || []).slice(0, 5).map((a) => (
                        <div key={a.transaction_id} className="flex items-start justify-between gap-3 text-xs">
                          <div>
                            <div className="font-semibold text-slate-200">{a.merchant}</div>
                            <div className="text-slate-400">
                              {a.posted_date} {a.category}
                            </div>
                            <div className="text-slate-500">{a.reason}</div>
                          </div>
                          <div className="font-bold text-slate-100">{fmtMoney(a.amount)}</div>
                        </div>
                      ))}
                      {!anomalies?.anomalies?.length ? (
                        <div className="text-xs text-slate-400">No anomalies flagged by the demo rule.</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionShell>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SectionShell title="KPIs (Month to Date)">
            {kpis ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card title="MTD Total Spend" value={fmtMoney(kpis.mtd_total_spend)} />
                <Card title="MTD Net Cashflow" value={fmtMoney(kpis.mtd_net_cashflow)} />
                <Card
                  title="Recurring Total"
                  value={fmtMoney(kpis.mtd_recurring_total)}
                  subtext="Subscriptions category"
                />
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

          <SectionShell title="AI insights">
            <InsightCards
              month={selectedMonth}
              onDrilldown={(dd) => {
                if (!dd) return;

                if (dd.type === "category") {
                  setSelectedCategory(dd.value);
                  loadCategoryBreakdown(selectedMonth, dd.value);
                  return;
                }

                if (dd.type === "subscriptions") {
                  navigate("/subscriptions");
                }
              }}
            />
          </SectionShell>
        </div>
      </div>

      <SectionShell title="Trends (from analytics engine)">
        {charts ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Spend by category (latest month)
                </div>

                <div className="mt-3">
                  <SpendByCategoryChart
                    data={spendByCategory}
                    onSelectCategory={(category) => {
                      setSelectedCategory(category);
                      loadCategoryBreakdown(selectedMonth, category);
                    }}
                  />
                </div>

                {selectedCategory ? (
                  <div className="mt-3 text-xs text-slate-300">
                    Selected category: <span className="font-semibold text-white">{selectedCategory}</span>
                  </div>
                ) : null}

                <div className="mt-3 text-xs text-slate-500">Tip: click a bar to open category drilldown</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drilldown</div>
                  {selectedCategory ? (
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setCategoryBreakdown(null);
                      }}
                      className="text-xs font-semibold text-slate-300 hover:text-white"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {!selectedCategory ? (
                  <div className="mt-3 text-sm text-slate-400">Click a bar to see details.</div>
                ) : loadingDrilldown ? (
                  <div className="mt-3 text-sm text-slate-400">Loading breakdown...</div>
                ) : !categoryBreakdown ? (
                  <div className="mt-3 text-sm text-slate-400">No breakdown available.</div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top merchants</div>
                      <div className="mt-2 space-y-2">
                        {(categoryBreakdown.top_merchants || []).map((m) => (
                          <div key={m.merchant} className="flex items-center justify-between text-xs">
                            <span className="text-slate-200">{m.merchant}</span>
                            <span className="font-bold text-slate-100">{fmtMoney(m.total_spend)}</span>
                          </div>
                        ))}
                        {!categoryBreakdown.top_merchants?.length ? (
                          <div className="text-xs text-slate-400">
                            No spend found for this category in {categoryBreakdown.month}.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Top transactions
                      </div>
                      <div className="mt-2 space-y-2">
                        {(categoryBreakdown.top_transactions || []).map((t) => (
                          <div key={t.transaction_id} className="flex items-start justify-between gap-3 text-xs">
                            <div>
                              <div className="font-semibold text-slate-200">{t.merchant}</div>
                              <div className="text-slate-400">
                                {t.posted_date} {t.account_id}
                              </div>
                            </div>
                            <div className="font-bold text-slate-100">{fmtMoney(t.amount)}</div>
                          </div>
                        ))}
                        {!categoryBreakdown.top_transactions?.length ? (
                          <div className="text-xs text-slate-400">No transactions found.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
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
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">What it means</div>
                <div className="mt-3 text-sm text-slate-300">
                  Track whether you stay cashflow positive and identify months where spending overtakes income.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Daily spend trend (latest 14d)
                </div>

                <div className="mt-3">
                  <DailySpendTrendChart data={dailyTrend.slice(-14)} height={260} />
                </div>

                <div className="mt-3 text-xs text-slate-500">Hover points to see day and spend.</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pattern check</div>
                <div className="mt-3 text-sm text-slate-300">
                  Spikes often indicate one time purchases or subscription billing days. Use drilldowns to confirm.
                </div>
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
