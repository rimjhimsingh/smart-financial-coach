"""
Copilot Routes
--------------
Provides AI powered chat and insight card generation using Gemini with caching and safe JSON parsing.
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, Optional

from flask import Blueprint, jsonify, request

from ..services.gemini_client import get_gemini_client
from ..services.store import STORE

try:
    from google.genai.errors import ClientError
except Exception:
    ClientError = Exception

copilot_bp = Blueprint("copilot", __name__)

_INSIGHTS_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SEC = 180
_MAX_ROWS_DEFAULT = 300
_MAX_ROWS_LIMIT = 1000


def _clamp_max_rows(value: Any) -> int:
    """Parse and clamp max_rows to a safe integer range."""
    try:
        n = int(value)
    except Exception:
        n = _MAX_ROWS_DEFAULT
    if n < 1:
        return 1
    if n > _MAX_ROWS_LIMIT:
        return _MAX_ROWS_LIMIT
    return n


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    """Return cached data if present and not expired."""
    item = _INSIGHTS_CACHE.get(key)
    if not item:
        return None
    if (time.time() - float(item.get("ts", 0.0))) > _CACHE_TTL_SEC:
        _INSIGHTS_CACHE.pop(key, None)
        return None
    data = item.get("data")
    if isinstance(data, dict):
        return data
    return None


def _cache_set(key: str, data: Dict[str, Any]) -> None:
    """Store data in cache with current timestamp."""
    _INSIGHTS_CACHE[key] = {"ts": time.time(), "data": data}


def _strip_markdown_fences(text: str) -> str:
    """Remove accidental markdown code fences from model output."""
    t = (text or "").strip()
    if not t.startswith("```"):
        return t
    t = t.strip()
    t = t.strip("`").strip()
    if t.lower().startswith("json"):
        t = t[4:].strip()
    return t


def _safe_json(text: str) -> Any:
    """Parse JSON from model output, tolerating minor formatting noise."""
    cleaned = _strip_markdown_fences(text)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    try:
        decoder = json.JSONDecoder()
        obj, _idx = decoder.raw_decode(cleaned)
        return obj
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = cleaned[start : end + 1]
        try:
            decoder = json.JSONDecoder()
            obj, _idx = decoder.raw_decode(snippet)
            return obj
        except Exception:
            pass

    raise json.JSONDecodeError("Could not parse JSON", cleaned, 0)


@copilot_bp.post("/copilot/chat")
def copilot_chat():
    """Answer a user question using recent transactions and return strict JSON."""
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    max_rows = _clamp_max_rows(body.get("max_rows", _MAX_ROWS_DEFAULT))

    if not message:
        return jsonify({"error": "message is required"}), 400

    df = STORE.transactions
    if df is None or df.empty:
        return jsonify({"error": "No transactions loaded. Seed data first."}), 400

    data = df.to_dict(orient="records")
    if len(data) > max_rows:
        data = data[-max_rows:]

    prompt = {
        "question": message,
        "transactions": data,
        "output_format": {"answer": "string", "bullets": ["string"], "followups": ["string"]},
    }

    system_text = (
        "You are a personal finance assistant. "
        "Use the provided transactions to answer. "
        "Return ONLY valid JSON. No markdown. No extra text. "
        "JSON keys: answer, bullets, followups."
    )

    try:
        client = get_gemini_client()
        resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=system_text + "\n\n" + json.dumps(prompt, default=str),
        )
        payload = _safe_json(resp.text or "")
        return jsonify(payload), 200

    except ClientError as e:
        status = getattr(e, "status_code", None) or 500
        try:
            msg = str(e)
        except Exception:
            msg = "Gemini error"

        if status == 429 or "RESOURCE_EXHAUSTED" in msg:
            return (
                jsonify(
                    {
                        "answer": "AI is temporarily rate limited. Please retry shortly.",
                        "bullets": [],
                        "followups": [],
                        "meta": {"ai_status": "rate_limited"},
                    }
                ),
                200,
            )

        return jsonify({"error": "Gemini request failed", "details": msg}), 200

    except Exception as e:
        return jsonify({"error": "Copilot failed", "details": str(e)}), 200


@copilot_bp.get("/copilot/insights")
def copilot_insights():
    """Generate 5 insight cards for a given month, using caching to reduce repeated calls."""
    month = (request.args.get("month") or "").strip()
    max_rows = _clamp_max_rows(request.args.get("max_rows", _MAX_ROWS_DEFAULT))

    df = STORE.transactions
    if df is None or df.empty:
        return jsonify({"cards": [], "meta": {"ai_status": "no_data"}}), 200

    if month and "posted_date" in df.columns:
        try:
            df2 = df[df["posted_date"].astype(str).str.startswith(month)]
            if not df2.empty:
                df = df2
        except Exception:
            pass

    cache_key = f"insights:{month}:{max_rows}:{len(df)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached), 200

    data = df.to_dict(orient="records")
    if len(data) > max_rows:
        data = data[-max_rows:]

    prompt = {
        "month": month,
        "goal": "Generate 5 high impact insight cards from these transactions.",
        "transactions": data,
        "output_format": {
            "cards": [
                {
                    "title": "string",
                    "metric": "string",
                    "why": "string",
                    "action": "string",
                    "drilldown": {"type": "string", "value": "string"},
                }
            ]
        },
    }

    system_text = (
        "You are a personal finance assistant. "
        "Return ONLY valid JSON. No markdown. No extra text. "
        "Return exactly this shape: {\"cards\": [...]} with exactly 5 cards. "
        "Each card must include keys: title, metric, why, action, drilldown {type,value}. "
        "The 5 cards must cover exactly these topics in order: "
        "1) Biggest month over month category increase with top contributing merchants "
        "2) Recurring spend summary with top subscriptions by annual cost "
        "3) Anomaly highlight: unusually high transaction or category spike with baseline comparison "
        "4) Coffee or dining insight with annualized savings estimate "
        "5) Quick win: smallest change with noticeable impact (cancel 1 subscription or cap 1 category). "
        "If you lack prior month data, infer the biggest category and say comparison is limited. "
        "Use numbers from the transactions. Keep each field short."
    )

    try:
        client = get_gemini_client()
        resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=system_text + "\n\n" + json.dumps(prompt, default=str),
        )

        payload = _safe_json(resp.text or "")
        cards = payload.get("cards", []) if isinstance(payload, dict) else []
        if not isinstance(cards, list):
            cards = []

        out = {"cards": cards[:5], "meta": {"ai_status": "ok"}}
        _cache_set(cache_key, out)
        return jsonify(out), 200

    except ClientError as e:
        status = getattr(e, "status_code", None) or 500
        try:
            msg = str(e)
        except Exception:
            msg = "Gemini error"

        if status == 429 or "RESOURCE_EXHAUSTED" in msg:
            out = {
                "cards": [],
                "meta": {"ai_status": "rate_limited", "message": "Gemini quota exceeded. Retry shortly."},
            }
            _cache_set(cache_key, out)
            return jsonify(out), 200

        out = {"cards": [], "meta": {"ai_status": "error", "message": "Gemini request failed"}}
        _cache_set(cache_key, out)
        return jsonify(out), 200

    except Exception as e:
        out = {"cards": [], "meta": {"ai_status": "error", "message": str(e)}}
        _cache_set(cache_key, out)
        return jsonify(out), 200
