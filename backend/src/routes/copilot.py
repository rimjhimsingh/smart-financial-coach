# backend/src/routes/copilot.py
import json
import time
from flask import Blueprint, jsonify, request

from ..services.store import STORE
from ..services.gemini_client import get_gemini_client

try:
    from google.genai.errors import ClientError
except Exception:
    ClientError = Exception

copilot_bp = Blueprint("copilot", __name__)

# Cache (prevents repeated Gemini calls when the dashboard re-renders)
_INSIGHTS_CACHE = {}  # key -> {"ts": float, "data": dict}
_CACHE_TTL_SEC = 180

def _cache_get(key: str):
    item = _INSIGHTS_CACHE.get(key)
    if not item:
        return None
    if (time.time() - item["ts"]) > _CACHE_TTL_SEC:
        _INSIGHTS_CACHE.pop(key, None)
        return None
    return item["data"]

def _cache_set(key: str, data: dict):
    _INSIGHTS_CACHE[key] = {"ts": time.time(), "data": data}

def _safe_json(text: str):
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise

@copilot_bp.post("/copilot/chat")
def copilot_chat():
    body = request.get_json(force=True) or {}
    message = (body.get("message") or "").strip()
    max_rows = int(body.get("max_rows", 300))

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
            return jsonify(
                {
                    "answer": "AI is temporarily rate limited. Please retry shortly.",
                    "bullets": [],
                    "followups": [],
                    "meta": {"ai_status": "rate_limited"},
                }
            ), 200
        return jsonify({"error": "Gemini request failed", "details": msg}), 200

    except Exception as e:
        return jsonify({"error": "Copilot failed", "details": str(e)}), 200

@copilot_bp.get("/copilot/insights")
def copilot_insights():
    month = request.args.get("month") or ""
    max_rows = int(request.args.get("max_rows", 300))

    df = STORE.transactions
    if df is None or df.empty:
        return jsonify({"cards": [], "meta": {"ai_status": "no_data"}}), 200

    # Filter to requested month if possible
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
        cards = payload.get("cards", [])
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

        # If rate-limited, return cached if any previous month cache exists, else return empty safely
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
