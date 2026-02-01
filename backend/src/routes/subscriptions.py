"""
Subscriptions Routes
--------------------
This module exposes the subscriptions endpoint used by the UI to surface recurring charges.

What this file does:
- Defines a Flask blueprint for subscription related routes.
- Implements a single GET endpoint that scans the loaded transactions and returns a list of
  recurring merchants, including potential trial to paid conversions when enabled.

How the endpoint works:
- Reads an optional min_occurrences query parameter to control the minimum number of repeats
  required for a merchant to be considered recurring.
- Calls the recurring detection service to compute recurring candidates from transaction history.
- Returns the result in a stable JSON shape: {"subscriptions": [...]}.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.recurring_service import detect_recurring_by_merchant

subscriptions_bp = Blueprint("subscriptions", __name__)


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


@subscriptions_bp.get("/subscriptions")
def subscriptions():
    min_occ = _clamp_int(request.args.get("min_occurrences"), default=2, min_value=2, max_value=24)
    data = detect_recurring_by_merchant(min_occurrences=min_occ, include_zero_trials=True)
    return jsonify({"subscriptions": data}), 200
