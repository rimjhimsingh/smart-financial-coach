"""
Dashboard Routes
----------------
Provides KPI summary, charts, drilldowns, deltas, and anomaly endpoints.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.analytics_service import (
    get_anomalies,
    get_category_breakdown,
    get_dashboard_charts,
    get_dashboard_summary,
    get_monthly_deltas,
)

dashboard_bp = Blueprint("dashboard", __name__)


def _clamp_int(value, default: int, min_value: int, max_value: int) -> int:
    """Parse and clamp an int query param into a safe range."""
    try:
        n = int(value)
    except Exception:
        n = default
    if n < min_value:
        return min_value
    if n > max_value:
        return max_value
    return n


@dashboard_bp.get("/dashboard/summary")
def dashboard_summary():
    return jsonify({"kpis": get_dashboard_summary()}), 200


@dashboard_bp.get("/dashboard/charts")
def dashboard_charts():
    month = request.args.get("month")
    return jsonify({"charts": get_dashboard_charts(month=month)}), 200


@dashboard_bp.get("/dashboard/category-breakdown")
def category_breakdown():
    month = request.args.get("month")
    category = request.args.get("category")

    merchant_limit = _clamp_int(
        request.args.get("merchantLimit"),
        default=10,
        min_value=1,
        max_value=200,
    )
    tx_limit = _clamp_int(
        request.args.get("txLimit"),
        default=10,
        min_value=1,
        max_value=500,
    )

    try:
        data = get_category_breakdown(
            month=month,
            category=category,
            merchant_limit=merchant_limit,
            tx_limit=tx_limit,
        )
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@dashboard_bp.get("/dashboard/insights/monthly-deltas")
def monthly_deltas():
    month = request.args.get("month")

    top_k = _clamp_int(
        request.args.get("topK"),
        default=3,
        min_value=1,
        max_value=50,
    )
    merchants_per_category = _clamp_int(
        request.args.get("merchantsPerCategory"),
        default=5,
        min_value=1,
        max_value=50,
    )

    try:
        data = get_monthly_deltas(
            month=month,
            top_k=top_k,
            merchants_per_category=merchants_per_category,
        )
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@dashboard_bp.get("/dashboard/anomalies")
def anomalies():
    days = _clamp_int(
        request.args.get("days"),
        default=30,
        min_value=1,
        max_value=365,
    )
    limit = _clamp_int(
        request.args.get("limit"),
        default=10,
        min_value=1,
        max_value=200,
    )
    return jsonify(get_anomalies(days=days, limit=limit)), 200
