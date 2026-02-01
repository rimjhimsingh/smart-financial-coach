"""
Main Routes
-----------
This module defines the core, non feature specific API endpoints for the backend.

Endpoints in this file provide:
- A simple health check to confirm the API process is running and reachable.
- A demo seeding endpoint that loads sample transaction data into the in memory store so the
  dashboard and other features can be exercised without external integrations.
- A stats endpoint that returns high level ingestion and dataset summary information.
- A transactions listing endpoint that returns recent transactions with optional filtering by
  account and a configurable row limit.

Helper functions in this file:
- _clamp_int: Parses and bounds integer query parameters to safe ranges to prevent invalid
  inputs or excessively large responses.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.ingestion_service import get_stats, list_transactions, seed_demo_data

main_bp = Blueprint("main", __name__)


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


@main_bp.get("/health")
def health():
    return (
        jsonify(
            {
                "status": "online",
                "message": "Smart Financial Coach API is running",
                "version": "0.1.0",
            }
        ),
        200,
    )


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
    limit = _clamp_int(request.args.get("limit"), default=25, min_value=1, max_value=500)

    rows = list_transactions(account_id=account_id, limit=limit)
    return jsonify({"transactions": rows, "count": len(rows)}), 200
