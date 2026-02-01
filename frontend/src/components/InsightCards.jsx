import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";
import Modal from "./Modal";
import { fmtMoney } from "../utils/format";

function Card({ title, metric, why, action, onViewDetails }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-xl font-extrabold text-white">{metric}</div>
      <div className="mt-2 text-sm text-slate-300">{why}</div>
      <div className="mt-3 text-sm font-semibold text-slate-200">{action}</div>
      <button
        onClick={onViewDetails}
        className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
      >
        View details
      </button>
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
        {right || null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function InsightCards({ month, onDrilldown }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [aiStatus, setAiStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailText, setDetailText] = useState("");

  const [drillLoading, setDrillLoading] = useState(false);
  const [categoryBreakdown, setCategoryBreakdown] = useState(null);

  const [subsLoading, setSubsLoading] = useState(false);
  const [subsData, setSubsData] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorText("");
      setAiStatus("");

      try {
        const res = await dashboardApi.copilotInsights(month);
        const payload = res?.data ?? res;

        const nextCards = Array.isArray(payload?.cards) ? payload.cards : [];
        const meta = payload?.meta || {};

        if (!mounted) return;

        setCards(nextCards.slice(0, 5));

        if (meta.ai_status) setAiStatus(meta.ai_status);
        if (meta.message) setErrorText(meta.message);
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

  const modalTitle = useMemo(() => {
    if (!activeCard) return "Details";
    return activeCard.title || "Details";
  }, [activeCard]);

  function closeModal() {
    setModalOpen(false);
    setActiveCard(null);
    setDetailText("");
    setCategoryBreakdown(null);
    setSubsData(null);
    setDetailLoading(false);
    setDrillLoading(false);
    setSubsLoading(false);
  }

  async function openDetails(card) {
    setActiveCard(card);
    setModalOpen(true);

    setDetailText("");
    setCategoryBreakdown(null);
    setSubsData(null);

    await Promise.all([
      fetchAiDeepDive(card).catch(() => {}),
      fetchDrilldown(card).catch(() => {}),
    ]);
  }

  async function fetchAiDeepDive(card) {
    if (!card) return;
    setDetailLoading(true);

    try {
      const prompt =
        `You are a smart financial coach. Expand this insight into a clear, actionable plan.\n` +
        `Month: ${month || "unknown"}\n` +
        `Insight title: ${card.title}\n` +
        `Metric: ${card.metric}\n` +
        `Why: ${card.why}\n` +
        `Recommended action: ${card.action}\n\n` +
        `Return a concise response with these sections:\n` +
        `1) What happened (2 bullets)\n` +
        `2) Likely drivers (2 to 4 bullets)\n` +
        `3) Action plan (3 to 5 bullets with concrete numbers)\n` +
        `4) Expected impact (estimate savings per month and per year if applicable)\n` +
        `5) Caveats and trust notes (1 to 2 bullets)\n`;

      const res = await dashboardApi.copilotChat(prompt, month, 220);
      const payload = res?.data ?? res;

      const text =
        payload?.answer ||
        payload?.message ||
        (typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));

      setDetailText(text);
    } catch (e) {
      setDetailText("Could not generate expanded AI details. You can retry.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function fetchDrilldown(card) {
    const dd = card?.drilldown;
    if (!dd || !dd.type) return;

    if (dd.type === "category" && dd.value) {
      setDrillLoading(true);
      try {
        const res = await dashboardApi.categoryBreakdown(month, dd.value, 10, 10);
        const payload = res?.data ?? res;
        setCategoryBreakdown(payload || null);
      } catch (e) {
        setCategoryBreakdown(null);
      } finally {
        setDrillLoading(false);
      }
      return;
    }

    if (dd.type === "subscriptions") {
      setSubsLoading(true);
      try {
        const res = await dashboardApi.subscriptions(2);
        const payload = res?.data ?? res;
        setSubsData(payload || null);
      } catch (e) {
        setSubsData(null);
      } finally {
        setSubsLoading(false);
      }
    }
  }

  function renderAiTextBlock(text) {
    const safe = (text || "").trim();
    if (!safe) return null;

    return (
      <pre className="whitespace-pre-wrap text-sm text-slate-200">{safe}</pre>
    );
  }

  const cancelCandidates = useMemo(() => {
    const subs = subsData?.subscriptions || [];
    return [...subs]
      .sort((a, b) => (b.annualized_cost || 0) - (a.annualized_cost || 0))
      .slice(0, 8);
  }, [subsData]);

  return (
    <div className="bg-transparent p-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-white"></div>
        {loading ? <div className="text-xs text-slate-500">Generating...</div> : null}
      </div>

      {aiStatus === "rate_limited" ? (
        <div className="mt-2 rounded-xl border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-200">
          AI insights temporarily unavailable due to Gemini quota. Showing cached or empty results.
        </div>
      ) : null}

      {errorText ? <div className="mt-2 text-xs text-red-300">{errorText}</div> : null}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {cards.map((c, idx) => (
          <Card
            key={idx}
            title={c.title}
            metric={c.metric}
            why={c.why}
            action={c.action}
            onViewDetails={() => openDetails(c)}
          />
        ))}

        {!loading && cards.length === 0 && !errorText ? (
          <div className="text-sm text-slate-400">No insights yet. Seed data and retry.</div>
        ) : null}
      </div>

      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        {!activeCard ? (
          <div className="text-sm text-slate-400">No insight selected.</div>
        ) : (
          <div className="space-y-4">
            <Section title="Insight summary">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Metric</div>
                  <div className="mt-1 text-base font-extrabold text-white">{activeCard.metric}</div>
                </div>
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it matters</div>
                  <div className="mt-1 text-sm text-slate-200">{activeCard.why}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{activeCard.action}</div>
                </div>
              </div>

              {activeCard?.drilldown ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onDrilldown?.(activeCard.drilldown)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Highlight on dashboard
                  </button>
                  <div className="text-xs text-slate-500">
                    This does not navigate. It highlights the relevant data view.
                  </div>
                </div>
              ) : null}
            </Section>

            <Section
              title="AI deep dive"
              right={
                <button
                  onClick={() => fetchAiDeepDive(activeCard)}
                  disabled={detailLoading}
                  className={
                    "rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold " +
                    (detailLoading ? "bg-slate-900 text-slate-500" : "bg-slate-900 text-slate-200 hover:bg-slate-800")
                  }
                >
                  {detailLoading ? "Generating..." : "Regenerate"}
                </button>
              }
            >
              {detailLoading && !detailText ? (
                <div className="text-sm text-slate-400">Generating detailed plan...</div>
              ) : detailText ? (
                renderAiTextBlock(detailText)
              ) : (
                <div className="text-sm text-slate-400">No AI details yet.</div>
              )}
            </Section>

            {activeCard?.drilldown?.type === "category" ? (
              <Section title={`Category drilldown: ${activeCard.drilldown.value || ""}`}>
                {drillLoading ? (
                  <div className="text-sm text-slate-400">Loading category drilldown...</div>
                ) : !categoryBreakdown ? (
                  <div className="text-sm text-slate-400">No drilldown data available.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top merchants</div>
                      <div className="mt-2 space-y-2">
                        {(categoryBreakdown.top_merchants || []).map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-200">{m.merchant}</span>
                            <span className="font-semibold text-slate-100">
                              {fmtMoney(m.total_spend ?? m.total ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top transactions</div>
                      <div className="mt-2 space-y-2">
                        {(categoryBreakdown.top_transactions || []).map((t, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 text-sm">
                            <div>
                              <div className="font-semibold text-slate-100">{t.merchant}</div>
                              <div className="text-xs text-slate-400">
                                {t.posted_date} {t.account_id ? `  ${t.account_id}` : ""}
                              </div>
                            </div>
                            <div className="font-semibold text-slate-100">{fmtMoney(t.amount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            ) : null}

            {activeCard?.drilldown?.type === "subscriptions" ? (
              <Section title="Subscriptions cancel candidates">
                {subsLoading ? (
                  <div className="text-sm text-slate-400">Loading subscriptions...</div>
                ) : !subsData ? (
                  <div className="text-sm text-slate-400">No subscriptions data available.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-slate-300">
                      Prioritized by annualized cost across all accounts.
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <div className="space-y-2">
                        {cancelCandidates.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-semibold text-slate-100">{s.merchant}</div>
                              <div className="text-xs text-slate-400">
                                cadence: {s.cadence}  confidence: {Math.round((s.confidence || 0) * 100)}%
                                {s.flags?.trial_to_paid ? "  trial-to-paid" : ""}
                                {s.flags?.price_increase ? "  price-increase" : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-white">{fmtMoney(s.annualized_cost || 0)}/yr</div>
                              <div className="text-xs text-slate-400">{fmtMoney(s.amount || 0)} per charge</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      This is designed to help young adults and gig workers quickly identify wasteful recurring spend.
                    </div>
                  </div>
                )}
              </Section>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
