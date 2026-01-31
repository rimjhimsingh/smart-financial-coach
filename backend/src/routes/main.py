from flask import Blueprint, jsonify, request
from ..services.ingestion_service import seed_demo_data, get_stats, list_transactions

main_bp = Blueprint("main", __name__)

@main_bp.get("/health")
def health():
    return jsonify({
        "status": "online",
        "message": "Smart Financial Coach API is running",
        "version": "0.1.0"
    })

@main_bp.post("/seed")
def seed():
    result = seed_demo_data()
    return jsonify(result), 200

@main_bp.get("/stats")
def stats():
    return jsonify(get_stats()), 200

@main_bp.get("/transactions")
def transactions():
    account_id = request.args.get("account_id")
    limit = request.args.get("limit", default=25, type=int)
    rows = list_transactions(account_id=account_id, limit=limit)
    return jsonify({"transactions": rows, "count": len(rows)}), 200
