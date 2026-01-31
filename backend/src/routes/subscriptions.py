from flask import Blueprint, jsonify, request
from ..services.recurring_service import detect_recurring_by_merchant

subscriptions_bp = Blueprint("subscriptions", __name__)

@subscriptions_bp.get("/subscriptions")
def subscriptions():
    min_occ = request.args.get("min_occurrences", default=2, type=int)
    data = detect_recurring_by_merchant(min_occurrences=min_occ, include_zero_trials=True)
    return jsonify({"subscriptions": data}), 200
