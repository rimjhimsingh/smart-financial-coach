from flask import Blueprint, jsonify
from ..services.analytics_service import get_dashboard_summary, get_dashboard_charts

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.get("/dashboard/summary")
def dashboard_summary():
    return jsonify({"kpis": get_dashboard_summary()}), 200
    
@dashboard_bp.get("/dashboard/charts")
def dashboard_charts():
    return jsonify({"charts": get_dashboard_charts()}), 200
