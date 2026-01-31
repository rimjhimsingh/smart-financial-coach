from flask import Blueprint, jsonify
from flask import Blueprint, jsonify, request
from ..services.analytics_service import (
    get_dashboard_summary,
    get_dashboard_charts,
    get_category_breakdown,
    get_monthly_deltas,
)
from ..services.analytics_service import get_anomalies

dashboard_bp = Blueprint("dashboard", __name__)

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
    merchant_limit = request.args.get("merchantLimit", default=10, type=int)
    tx_limit = request.args.get("txLimit", default=10, type=int)

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
    top_k = request.args.get("topK", default=3, type=int)
    merchants_per_category = request.args.get("merchantsPerCategory", default=5, type=int)

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
    days = request.args.get("days", default=30, type=int)
    limit = request.args.get("limit", default=10, type=int)
    return jsonify(get_anomalies(days=days, limit=limit)), 200