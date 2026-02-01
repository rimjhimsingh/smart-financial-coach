"""
Recurring Detection Service
---------------------------
This module detects recurring charges by analyzing transaction history grouped by merchant.

It provides:
- detect_recurring_by_merchant: Scans transactions in STORE, groups by merchant, infers cadence
  (weekly, biweekly, monthly, annual) from the median gap between charges, computes average charge,
  annualized cost, confidence, and flags like trial to paid conversion and likely price increases.

How it works at a high level:
- Normalizes posted_date to datetime and filters to debit like rows (negative amounts) with an option
  to include zero dollar trials.
- For each merchant, computes day gaps between charge dates and matches them to cadence rules with
  tolerances.
- Computes subscription metrics (average amount, last charged date, occurrences, annualized cost).
- Applies heuristics to flag trial to paid patterns and detect strict price increases only on stable,
  subscription like series.
- Produces a sorted list of recurring candidates ordered by annualized cost for prioritization.
"""
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

from .store import STORE

_CADENCE_RULES = [
    ("weekly", 7, 3, 52),
    ("biweekly", 14, 4, 26),
    ("monthly", 30, 10, 12),
    ("annual", 365, 20, 1),
]


def _safe_datetime(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors="coerce")


def _pick_cadence(gaps: np.ndarray) -> Optional[Dict[str, Any]]:
    if gaps.size == 0:
        return None

    med = float(np.median(gaps))
    std = float(np.std(gaps)) if gaps.size > 1 else 0.0

    for name, target, tol, annual_mult in _CADENCE_RULES:
        if abs(med - target) <= tol:
            return {
                "cadence": name,
                "median_gap_days": round(med, 2),
                "std_gap_days": round(std, 2),
                "annual_multiplier": annual_mult,
                "tolerance_days": tol,
            }
    return None


def _flag_trial_to_paid(amounts: np.ndarray) -> bool:
    if amounts.size < 2:
        return False

    first = float(amounts[0])
    rest = amounts[1:]

    if first <= 1.0 and float(np.median(rest)) >= 5.0:
        return True

    if first > 0 and float(np.median(rest)) >= first * 2.5:
        return True

    return False


def _is_amount_stable(amounts: np.ndarray, max_cv: float) -> bool:
    if amounts.size < 3:
        return False
    mean = float(np.mean(amounts))
    if mean <= 0:
        return False
    std = float(np.std(amounts))
    cv = std / mean
    return cv <= max_cv


def _stable_new_price(amounts: np.ndarray, rel_tol: float = 0.05) -> bool:
    """
    Ensures the last 2 charges are close to each other, which indicates a real new price,
    not random variance. Requires at least 3 points overall.
    """
    if amounts.size < 3:
        return False

    last = float(amounts[-1])
    prev = float(amounts[-2])

    if last <= 0 or prev <= 0:
        return False

    denom = max(prev, 1.0)
    return abs(last - prev) / denom <= rel_tol


def _flag_price_increase_strict(amounts: np.ndarray) -> bool:
    """
    Strict price increase for subscription-like series:
    - series must be stable overall (handled outside)
    - last 2 points must be close (stable new price)
    - second half median must exceed first half median by >= 15% and >= $2
    """
    if amounts.size < 3:
        return False

    if not _stable_new_price(amounts, rel_tol=0.05):
        return False

    mid = max(1, amounts.size // 2)
    first = amounts[:mid]
    second = amounts[mid:]

    m1 = float(np.median(first))
    m2 = float(np.median(second))

    if m1 <= 0:
        return False

    pct = (m2 - m1) / m1
    abs_inc = m2 - m1

    return pct >= 0.15 and abs_inc >= 2.0


def detect_recurring_by_merchant(
    min_occurrences: int = 2,
    include_zero_trials: bool = True,
) -> List[Dict[str, Any]]:
    df = STORE.transactions
    if df is None or df.empty:
        return []

    dff = df.copy()
    dff["posted_date"] = _safe_datetime(dff["posted_date"])
    dff = dff.dropna(subset=["posted_date", "merchant", "amount"])

    if include_zero_trials:
        dff = dff[dff["amount"] <= 0].copy()
    else:
        dff = dff[dff["amount"] < 0].copy()

    dff["abs_amount"] = dff["amount"].abs()

    results: List[Dict[str, Any]] = []

    for merchant, g in dff.groupby("merchant"):
        if g.shape[0] < min_occurrences:
            continue

        g = g.sort_values("posted_date")

        gaps = g["posted_date"].diff().dt.days.dropna().to_numpy(dtype=float)
        cadence_info = _pick_cadence(gaps)
        if cadence_info is None:
            continue

        cadence = cadence_info["cadence"]
        amounts = g["abs_amount"].to_numpy(dtype=float)

        trial_to_paid = _flag_trial_to_paid(amounts)
        paid_amounts = amounts[amounts > 1.0]

        # Keep recurring list broad, but optionally remove very variable weekly merchants
        if paid_amounts.size >= 3 and cadence in ["weekly", "biweekly"]:
            if not _is_amount_stable(paid_amounts, max_cv=0.20):
                continue

        # Price increase should be much stricter and only for subscription-like cadence
        price_increase = False
        if cadence in ["monthly", "annual"]:
            series_for_increase = paid_amounts if trial_to_paid else amounts
            series_for_increase = series_for_increase[series_for_increase > 1.0]

            # Must be subscription-like stable to consider price increase
            if series_for_increase.size >= 3 and _is_amount_stable(series_for_increase, max_cv=0.12):
                price_increase = _flag_price_increase_strict(series_for_increase)

        paid_for_avg = paid_amounts if trial_to_paid and paid_amounts.size > 0 else amounts
        paid_for_avg = paid_for_avg[paid_for_avg > 0]
        if paid_for_avg.size == 0:
            paid_for_avg = amounts

        avg_amount = round(float(np.mean(paid_for_avg)), 2)
        last_charged_date = str(pd.to_datetime(g["posted_date"].iloc[-1]).date())
        occurrences = int(g.shape[0])

        annualized_cost = round(avg_amount * cadence_info["annual_multiplier"], 2)

        std_gap = float(cadence_info["std_gap_days"])
        tol = float(cadence_info["tolerance_days"])
        regularity = 1.0 if std_gap <= tol else 0.6
        confidence = min(1.0, round((occurrences / 6.0) * regularity, 2))

        results.append(
            {
                "merchant": merchant,
                "cadence": cadence,
                "avg_amount": avg_amount,
                "last_charged_date": last_charged_date,
                "occurrences_count": occurrences,
                "annualized_cost": annualized_cost,
                "confidence": confidence,
                "flags": {
                    "trial_to_paid": trial_to_paid,
                    "price_increase": price_increase,
                },
            }
        )

    results.sort(key=lambda x: x["annualized_cost"], reverse=True)
    return results
