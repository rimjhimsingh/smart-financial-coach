import pandas as pd
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
def get_dashboard_charts() -> dict:
    df = STORE.transactions
    if df.empty:
        return {
            "spend_by_category_month": [],
            "in_vs_out_month": [],
            "daily_spend_trend": [],
        }

    dff = df.copy()
    dff["month"] = pd.to_datetime(dff["posted_date"]).dt.to_period("M").astype(str)

    # Chart 1: Spend by category for latest month (expenses only)
    latest_month = sorted(dff["month"].unique())[-1]
    spend_cat = (
        dff[(dff["month"] == latest_month) & (dff["amount"] < 0)]
        .groupby("category")["amount"]
        .sum()
        .abs()
        .sort_values(ascending=False)
    )
    spend_by_category_month = [{"category": k, "value": float(v)} for k, v in spend_cat.items()]

    # Chart 2: Money in vs money out by month (+net)
    income = dff[dff["amount"] > 0].groupby("month")["amount"].sum()
    out = dff[dff["amount"] < 0].groupby("month")["amount"].sum().abs()
    months = sorted(dff["month"].unique())

    in_vs_out_month = []
    for m in months:
        inc = float(income.get(m, 0.0))
        exp = float(out.get(m, 0.0))
        in_vs_out_month.append(
            {"month": m, "money_in": round(inc, 2), "money_out": round(exp, 2), "net": round(inc - exp, 2)}
        )

    # Chart 3: Daily spend trend (expenses only)
    dff["day"] = pd.to_datetime(dff["posted_date"]).dt.date
    daily = (
        dff[dff["amount"] < 0]
        .groupby("day")["amount"]
        .sum()
        .abs()
        .sort_index()
    )
    daily_spend_trend = [{"day": str(k), "spend": float(v)} for k, v in daily.items()]

    return {
        "spend_by_category_month": spend_by_category_month,
        "in_vs_out_month": in_vs_out_month,
        "daily_spend_trend": daily_spend_trend,
    }
