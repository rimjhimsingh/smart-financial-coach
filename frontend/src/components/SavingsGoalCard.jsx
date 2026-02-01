import React, { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";
import { fmtMoney } from "../utils/format";

const STORAGE_KEY = "sfc_goal_v1";

function loadGoal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed) return null;

        const amt = Number(parsed.targetAmount);
        const date = String(parsed.targetDate || "").trim();

        if (!Number.isFinite(amt) || amt <= 0) return null;
        if (!date) return null;

        return { targetAmount: amt, targetDate: date };
    } catch {
        return null;
    }
}

function saveGoal(goal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
}

function clearGoal() {
    localStorage.removeItem(STORAGE_KEY);
}

function monthsBetween(now, target) {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return 1;
    if (!(target instanceof Date) || Number.isNaN(target.getTime())) return 1;

    const ms = target.getTime() - now.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    if (days <= 0) return 1;

    const approxMonths = Math.ceil(days / 30.44);
    return Math.max(1, approxMonths);
}

const SUBS_ALLOW_PATTERNS = [
    "netflix",
    "spotify",
    "hulu",
    "disney",
    "prime",
    "amazon prime",
    "apple",
    "icloud",
    "google",
    "youtube",
    "microsoft",
    "office",
    "adobe",
    "dropbox",
    "github",
    "notion",
    "slack",
    "zoom",
    "openai",
    "chatgpt",
    "gym",
    "planet fitness",
    "peloton",
];

const SUBS_BLOCK_PATTERNS = [
    "rent",
    "mortgage",
    "property",
    "hoa",
    "loan",
    "tuition",
    "student",
    "insurance",
    "tax",
    "fee",
    "interest",
    "payment",
    "transfer",
    "zelle",
    "venmo",
    "paypal",
    "cash app",
    "atm",
    "air",
    "airlines",
    "flight",
    "hotel",
    "uber",
    "lyft",
];

function normalizeMerchant(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeRealSubscription(row) {
    const m = normalizeMerchant(row?.merchant);
    if (!m) return false;

    const cadence = String(row?.cadence || "").toLowerCase();
    if (cadence !== "monthly" && cadence !== "annual") return false;

    for (const bad of SUBS_BLOCK_PATTERNS) {
        if (m.includes(bad)) return false;
    }

    const avg = Number(row?.avg_amount || 0);
    if (!Number.isFinite(avg) || avg <= 0) return false;

    const monthly = Number(row?.annualized_cost || 0) / 12;
    const monthlyAmount = Number.isFinite(monthly) && monthly > 0 ? monthly : avg;

    if (monthlyAmount < 2) return false;
    if (monthlyAmount > 120) return false;

    const conf = Number(row?.confidence || 0);
    if (!Number.isFinite(conf) || conf < 0.45) return false;

    return true;
}

function isPreferredSubscription(row) {
    const m = normalizeMerchant(row?.merchant);
    if (!m) return false;
    return SUBS_ALLOW_PATTERNS.some((p) => m.includes(p));
}
function StatCard({ label, value, sub }) {
    return (
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/30 p-3 flex flex-col justify-between h-full">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate" title={label}>
                {label}
            </div>

            <div
                className="mt-1 max-w-full font-medium text-white tabular-nums text-xs leading-tight break-words"
                title={value}
            >
                {value}
            </div>

            {sub ? (
                <div className="mt-1 min-w-0 text-[10px] text-slate-500">
                    <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={sub}>
                        {sub}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
export default function SavingsGoalCard() {
    const [goal, setGoal] = useState(() => loadGoal());

    const [editing, setEditing] = useState(!goal);
    const [amountInput, setAmountInput] = useState(goal ? String(goal.targetAmount) : "");
    const [dateInput, setDateInput] = useState(goal ? String(goal.targetDate) : "");

    const [subs, setSubs] = useState([]);
    const [subsLoading, setSubsLoading] = useState(false);

    const [errorText, setErrorText] = useState("");

    useEffect(() => {
        let mounted = true;

        async function loadSubscriptions() {
            setSubsLoading(true);
            try {
                const res = await dashboardApi.subscriptions(2);
                const rows = Array.isArray(res?.subscriptions) ? res.subscriptions : [];
                if (mounted) setSubs(rows);
            } catch {
                if (mounted) setSubs([]);
            } finally {
                if (mounted) setSubsLoading(false);
            }
        }

        loadSubscriptions();
        return () => {
            mounted = false;
        };
    }, []);

    const computed = useMemo(() => {
        if (!goal) return null;

        const now = new Date();
        const targetDate = new Date(goal.targetDate + "T00:00:00");
        const monthsRemaining = monthsBetween(now, targetDate);

        const requiredMonthly = goal.targetAmount / monthsRemaining;

        const candidates = (subs || []).filter(looksLikeRealSubscription);

        const preferred = candidates.filter(isPreferredSubscription);
        const fallback = candidates.filter((r) => !isPreferredSubscription(r));

        const sortedPreferred = [...preferred].sort(
            (a, b) => Number(b.annualized_cost || 0) - Number(a.annualized_cost || 0)
        );
        const sortedFallback = [...fallback].sort(
            (a, b) => Number(b.annualized_cost || 0) - Number(a.annualized_cost || 0)
        );

        const topTwo = [...sortedPreferred, ...sortedFallback].slice(0, 2);

        const cancelMonthly =
            topTwo.reduce((sum, r) => sum + Number(r.annualized_cost || 0), 0) / 12;

        const rawPct = requiredMonthly > 0 ? (cancelMonthly / requiredMonthly) * 100 : 0;
        const coveragePct = Math.max(0, Math.min(999, rawPct));
        const coveragePctDisplay = Math.min(250, Math.round(coveragePct));

        return {
            monthsRemaining,
            requiredMonthly,
            topTwo,
            cancelMonthly,
            coveragePct,
            coveragePctDisplay,
            totalCandidates: candidates.length,
        };
    }, [goal, subs]);

    function onSave() {
        setErrorText("");

        const amt = Number(amountInput);
        const date = String(dateInput || "").trim();

        if (!Number.isFinite(amt) || amt <= 0) {
            setErrorText("Enter a valid target amount.");
            return;
        }
        if (!date) {
            setErrorText("Select a target date.");
            return;
        }

        const next = { targetAmount: amt, targetDate: date };
        saveGoal(next);
        setGoal(next);
        setEditing(false);
    }

    function onReset() {
        clearGoal();
        setGoal(null);
        setAmountInput("");
        setDateInput("");
        setEditing(true);
        setErrorText("");
    }

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-bold text-slate-100">Savings goal</div>

                <div className="flex shrink-0 items-center gap-2">
                    {!editing ? (
                        <button
                            onClick={() => setEditing(true)}
                            className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/60"
                        >
                            Edit
                        </button>
                    ) : null}

                    {goal ? (
                        <button
                            onClick={onReset}
                            className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/60"
                        >
                            Clear
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-4">
                {editing ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Target amount
                                </div>
                                <input
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(e.target.value)}
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="1000"
                                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                                />
                            </div>

                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Target date
                                </div>
                                <input
                                    value={dateInput}
                                    onChange={(e) => setDateInput(e.target.value)}
                                    type="date"
                                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                                />
                            </div>
                        </div>

                        {errorText ? <div className="text-xs text-red-300">{errorText}</div> : null}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onSave}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-500"
                            >
                                Save goal
                            </button>

                            {goal ? (
                                <button
                                    onClick={() => {
                                        setEditing(false);
                                        setErrorText("");
                                        setAmountInput(String(goal.targetAmount));
                                        setDateInput(String(goal.targetDate));
                                    }}
                                    className="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/60"
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>

                        <div className="text-xs text-slate-500">Stored locally on this device.</div>
                    </div>
                ) : goal && computed ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <StatCard
                                label="Goal"
                                value={fmtMoney(goal.targetAmount)}
                                sub={`By ${goal.targetDate}`}
                            />
                            <StatCard
                                label="Required per month"
                                value={fmtMoney(computed.requiredMonthly)}
                                sub={`Months remaining: ${computed.monthsRemaining}`}
                            />
                            <StatCard
                                label="Cancel top 2 subscriptions"
                                value={`${fmtMoney(computed.cancelMonthly)} / mo`}
                                sub={`Coverage: ${computed.coveragePctDisplay} percent`}
                            />
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Coach insight
                            </div>

                            {subsLoading ? (
                                <div className="mt-2 text-sm text-slate-400">Loading subscriptions...</div>
                            ) : computed.topTwo.length ? (
                                <div className="mt-2 space-y-2 text-sm text-slate-200">
                                    <div className="break-words">
                                        If you cancel your top 2 subscriptions, you cover{" "}
                                        <span className="font-bold text-white">
                                            {computed.coveragePctDisplay} percent
                                        </span>{" "}
                                        of your required monthly savings.
                                    </div>

                                    <div className="text-xs text-slate-400">Top 2 subscriptions</div>
                                    <div className="space-y-1">
                                        {computed.topTwo.map((s) => (
                                            <div
                                                key={`${s.merchant}-${s.cadence}`}
                                                className="flex min-w-0 items-center justify-between gap-3 text-xs"
                                            >
                                                <span
                                                    className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-slate-300"
                                                    title={String(s.merchant || "")}
                                                >
                                                    {s.merchant}
                                                </span>
                                                <span
                                                    className="shrink-0 font-semibold text-slate-100 tabular-nums"
                                                    title={fmtMoney(Number(s.annualized_cost || 0) / 12) + " / mo"}
                                                >
                                                    {fmtMoney(Number(s.annualized_cost || 0) / 12)} / mo
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 text-sm text-slate-400">
                                    No subscription style merchants detected yet. Add more history or check Recurring.
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-slate-500">
                            Tip: If the monthly number feels high, move your goal date out by a few months, then start with one quick win like canceling a low value subscription.
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-slate-400">Set a goal to get a personalized plan.</div>
                )}
            </div>
        </div>
    );
}
