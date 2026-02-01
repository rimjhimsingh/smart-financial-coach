"""
Analytics Service
-----------------
This module contains the backend analytics logic used by the dashboard endpoints.

It reads the in memory transactions dataset from STORE and computes:
- KPI summary metrics for the current month to date (spend, net cashflow, recurring totals),
  plus a simple anomaly count and a top spend driver category based on month over month change.
- Chart datasets for the dashboard (spend by category for a selected month, money in vs money out
  per month, and daily spend trend for a selected month).
- Drilldowns for a selected month and category (top merchants and top transactions).
- Month over month deltas (top category increases and the merchants driving those increases).
- Basic anomaly detection using a demo rule (large absolute transaction amounts) over a recent window.

Helper functions handle month resolution, available month discovery, date serialization for JSON,
and selecting a demo friendly "today" based on the max posted_date in the dataset.
"""

import pandas as pd
from typing import Optional

from .store import STORE


def _today_from_data(df: pd.DataFrame):
    # Demo-friendly: treat max date in data as "today"
    return df["posted_date"].max()


def get_dashboard_summary() -> dict:
    df = STORE.transactions
    if df.empty:
        return {
            "mtd_total_spend": 0.0,
            "mtd_net_cashflow": 0.0,
            "mtd_recurring_total": 0.0,
            "subscriptions_count": 0,
            "anomalies_count_30d": 0,
            "biggest_spend_driver": {"category": None, "delta": 0.0},
        }

    today = _today_from_data(df)
    mtd_start = today.replace(day=1)

    df_mtd = df[df["posted_date"] >= mtd_start]

    mtd_total_spend = float(df_mtd[df_mtd["amount"] < 0]["amount"].sum() * -1)
    mtd_net_cashflow = float(df_mtd["amount"].sum())

    mtd_recurring_total = float(
        df_mtd[(df_mtd["category"] == "Subscriptions") & (df_mtd["amount"] < 0)]["amount"].sum() * -1
    )

    subscriptions_count = int(
        df[(df["category"] == "Subscriptions") & (df["amount"] < 0)]["merchant"].nunique()
    )

    # Placeholder anomaly count: large absolute transactions in last 30 days
    last_30 = today - pd.Timedelta(days=30)
    df_30 = df[df["posted_date"] >= last_30]
    anomalies_count_30d = int((df_30["amount"].abs() > 500).sum())

    # Biggest spend driver: category delta vs previous month (expenses only)
    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)
    months = sorted(dff["month"].unique())

    biggest = {"category": None, "delta": 0.0}
    if len(months) >= 2:
        cur_m, prev_m = months[-1], months[-2]

        cur = (
            dff[(dff["month"] == cur_m) & (dff["amount"] < 0)]
            .groupby("category")["amount"]
            .sum()
            .abs()
        )
        prev = (
            dff[(dff["month"] == prev_m) & (dff["amount"] < 0)]
            .groupby("category")["amount"]
            .sum()
            .abs()
        )

        delta = (cur - prev).fillna(cur).sort_values(ascending=False)
        if not delta.empty:
            biggest = {"category": str(delta.index[0]), "delta": float(delta.iloc[0])}

    return {
        "mtd_total_spend": round(mtd_total_spend, 2),
        "mtd_net_cashflow": round(mtd_net_cashflow, 2),
        "mtd_recurring_total": round(mtd_recurring_total, 2),
        "subscriptions_count": subscriptions_count,
        "anomalies_count_30d": anomalies_count_30d,
        "biggest_spend_driver": biggest,
    }
def get_dashboard_charts(month: Optional[str] = None) -> dict:
    df = STORE.transactions
    if df.empty:
        return {
            "spend_by_category_month": [],
            "in_vs_out_month": [],
            "daily_spend_trend": [],
            "month": None,
            "available_months": [],
        }

    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)

    months = sorted(dff["month"].unique())
    resolved_month = _resolve_month(df, month)

    # Spend by category for selected month (expenses only)
    spend_cat = (
        dff[(dff["month"] == resolved_month) & (dff["amount"] < 0)]
        .groupby("category")["amount"]
        .sum()
        .abs()
        .sort_values(ascending=False)
    )
    spend_by_category_month = [{"category": k, "value": float(v)} for k, v in spend_cat.items()]

    # Money in vs money out by month (+net) across all months
    income = dff[dff["amount"] > 0].groupby("month")["amount"].sum()
    out = dff[dff["amount"] < 0].groupby("month")["amount"].sum().abs()

    in_vs_out_month = []
    for m in months:
        inc = float(income.get(m, 0.0))
        exp = float(out.get(m, 0.0))
        in_vs_out_month.append(
            {"month": m, "money_in": round(inc, 2), "money_out": round(exp, 2), "net": round(inc - exp, 2)}
        )

    # Daily spend trend for selected month, show last 14 days within that month if possible
    dff_month = dff[(dff["month"] == resolved_month) & (dff["amount"] < 0)].copy()
    dff_month["day"] = pd.to_datetime(dff_month["posted_date"]).dt.date
    daily = dff_month.groupby("day")["amount"].sum().abs().sort_index()
    daily_spend_trend = [{"day": str(k), "spend": float(v)} for k, v in daily.items()]

    return {
        "month": resolved_month,
        "available_months": months,
        "spend_by_category_month": spend_by_category_month,
        "in_vs_out_month": in_vs_out_month,
        "daily_spend_trend": daily_spend_trend,
    }

from typing import Optional


def _available_months(df: pd.DataFrame) -> list[str]:
    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)
    return sorted(dff["month"].unique())


def _resolve_month(df: pd.DataFrame, month: Optional[str]) -> str:
    months = _available_months(df)
    if not months:
        raise ValueError("No data loaded")

    if month is None or not str(month).strip():
        return months[-1]

    month = str(month).strip()
    if month not in months:
        raise ValueError(f"month must be one of: {months[-6:]} (showing last 6)")
    return month


def _serialize_transactions(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        rr = dict(r)
        d = rr.get("posted_date")
        if hasattr(d, "isoformat"):
            rr["posted_date"] = d.isoformat()
        out.append(rr)
    return out


def get_category_breakdown(
    month: Optional[str],
    category: str,
    merchant_limit: int = 10,
    tx_limit: int = 10,
) -> dict:
    df = STORE.transactions
    if df.empty:
        return {
            "month": None,
            "category": category,
            "top_merchants": [],
            "top_transactions": [],
        }

    if category is None or not str(category).strip():
        raise ValueError("category is required")

    category = str(category).strip()
    resolved_month = _resolve_month(df, month)

    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)

    df_month_cat = dff[(dff["month"] == resolved_month) & (dff["category"] == category)].copy()

    if df_month_cat.empty:
        return {
            "month": resolved_month,
            "category": category,
            "top_merchants": [],
            "top_transactions": [],
        }

    # Top merchants by spend (expenses only)
    df_exp = df_month_cat[df_month_cat["amount"] < 0].copy()
    if df_exp.empty:
        top_merchants = []
    else:
        spend_by_merchant = (
            df_exp.groupby("merchant")["amount"]
            .sum()
            .abs()
            .sort_values(ascending=False)
        )
        top_merchants = [
            {"merchant": m, "total_spend": round(float(v), 2)}
            for m, v in spend_by_merchant.head(merchant_limit).items()
        ]

    # Top transactions by absolute amount (includes refunds if present)
    df_month_cat["abs_amount"] = df_month_cat["amount"].abs()
    top_tx = (
        df_month_cat.sort_values("abs_amount", ascending=False)
        .drop(columns=["abs_amount"])
        .head(tx_limit)
        .to_dict(orient="records")
    )

    return {
        "month": resolved_month,
        "category": category,
        "top_merchants": top_merchants,
        "top_transactions": _serialize_transactions(top_tx),
    }


def get_monthly_deltas(
    month: Optional[str],
    top_k: int = 3,
    merchants_per_category: int = 5,
) -> dict:
    df = STORE.transactions
    if df.empty:
        return {"month": None, "previous_month": None, "top_category_increases": []}

    resolved_month = _resolve_month(df, month)

    months = _available_months(df)
    idx = months.index(resolved_month)
    if idx == 0:
        raise ValueError("No previous month available to compute deltas")

    prev_month = months[idx - 1]

    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)

    cur = dff[(dff["month"] == resolved_month) & (dff["amount"] < 0)].copy()
    prev = dff[(dff["month"] == prev_month) & (dff["amount"] < 0)].copy()

    cur_cat = cur.groupby("category")["amount"].sum().abs()
    prev_cat = prev.groupby("category")["amount"].sum().abs()

    delta_cat = (cur_cat - prev_cat).fillna(cur_cat).sort_values(ascending=False)

    top_categories = [c for c in delta_cat.index.tolist() if float(delta_cat[c]) > 0][:top_k]

    results = []
    for cat in top_categories:
        cur_total = float(cur_cat.get(cat, 0.0))
        prev_total = float(prev_cat.get(cat, 0.0))
        delta_total = float(delta_cat.get(cat, 0.0))

        cur_m = cur[cur["category"] == cat].groupby("merchant")["amount"].sum().abs()
        prev_m = prev[prev["category"] == cat].groupby("merchant")["amount"].sum().abs()

        merch_delta = (cur_m - prev_m).fillna(cur_m).sort_values(ascending=False)

        top_merchants = []
        for merchant, dval in merch_delta.head(merchants_per_category).items():
            top_merchants.append({
                "merchant": merchant,
                "delta": round(float(dval), 2),
                "current": round(float(cur_m.get(merchant, 0.0)), 2),
                "previous": round(float(prev_m.get(merchant, 0.0)), 2),
            })

        results.append({
            "category": cat,
            "delta": round(delta_total, 2),
            "current": round(cur_total, 2),
            "previous": round(prev_total, 2),
            "top_merchants": top_merchants,
        })

    return {
        "month": resolved_month,
        "previous_month": prev_month,
        "top_category_increases": results,
    }

def get_anomalies(days: int = 30, limit: int = 10) -> dict:
    df = STORE.transactions
    if df.empty:
        return {"days": days, "anomalies": []}

    today = _today_from_data(df)
    start = today - pd.Timedelta(days=days)
    dff = df[df["posted_date"] >= start].copy()

    # Demo rule: large absolute amounts
    dff["abs_amount"] = dff["amount"].abs()
    flagged = dff[dff["abs_amount"] > 500].sort_values("abs_amount", ascending=False)

    rows = flagged.drop(columns=["abs_amount"]).head(limit).to_dict(orient="records")
    out = _serialize_transactions(rows)

    # Attach a reason for UI
    for r in out:
        r["reason"] = "Large transaction (demo threshold > 500)"

    return {"days": days, "anomalies": out}