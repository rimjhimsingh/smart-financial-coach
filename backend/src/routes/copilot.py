"""
Copilot Routes
--------------
Provides AI powered chat and insight card generation using Gemini with caching and safe JSON parsing.

Key guarantees:
- /copilot/insights never returns an empty cards array (always returns 5 cards)
- If Gemini is rate limited or unavailable, cached insights are returned (even if stale)
- If no cache exists yet, deterministic fallback insights are generated from transaction data
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional

import pandas as pd
from flask import Blueprint, jsonify, request

from ..services.gemini_client import get_gemini_client
from ..services.store import STORE

try:
    from google.genai.errors import ClientError
except Exception:
    ClientError = Exception

copilot_bp = Blueprint("copilot", __name__)

_INSIGHTS_CACHE: Dict[str, Dict[str, Any]] = {}

_LAST_GOOD_BY_MONTH: Dict[str, Dict[str, Any]] = {}
_LAST_GOOD_GLOBAL: Optional[Dict[str, Any]] = None

_CACHE_TTL_SEC = int(os.getenv("INSIGHTS_CACHE_TTL_SEC", "21600"))
_MAX_ROWS_DEFAULT = 300
_MAX_ROWS_LIMIT = 1000


def _model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemma-3-27b-it")


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


def _cache_get(key: str, allow_stale: bool = False) -> Optional[Dict[str, Any]]:
    """
    Return cached data if present.

    If allow_stale is True, return cached values even if TTL is exceeded.
    Never returns cached payloads with empty or missing cards.
    """
    item = _INSIGHTS_CACHE.get(key)
    if not item:
        return None

    ts = float(item.get("ts", 0.0))
    age = time.time() - ts

    if (age > _CACHE_TTL_SEC) and (not allow_stale):
        return None

    data = item.get("data")
    if not isinstance(data, dict):
        return None

    cards = data.get("cards")
    if not isinstance(cards, list) or len(cards) == 0:
        return None

    return data


def _cache_set(key: str, data: Dict[str, Any]) -> None:
    """Store data in cache with current timestamp."""
    _INSIGHTS_CACHE[key] = {"ts": time.time(), "data": data}


def _remember_last_good(month: str, data: Dict[str, Any]) -> None:
    """Store last known good insights so we can recover even if a key changes."""
    global _LAST_GOOD_GLOBAL
    if month:
        _LAST_GOOD_BY_MONTH[month] = data
    _LAST_GOOD_GLOBAL = data


def _strip_markdown_fences(text: str) -> str:
    """Remove accidental markdown code fences from model output."""
    t = (text or "").strip()
    if not t.startswith("```"):
        return t
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
        decoder = json.JSONDecoder()
        obj, _idx = decoder.raw_decode(snippet)
        return obj

    raise json.JSONDecodeError("Could not parse JSON", cleaned, 0)


def _ensure_five_cards(cards: Any, fallback_cards: list[dict]) -> list[dict]:
    """Normalize to exactly 5 cards, padding with fallback as needed."""
    if not isinstance(cards, list):
        cards = []
    cards = cards[:5]
    if len(cards) < 5:
        cards = cards + fallback_cards[: (5 - len(cards))]
    return cards


def _fallback_cards_from_df(df: pd.DataFrame, month: str) -> list[dict]:
    """
    Deterministic, non AI fallback insights built from the available data.
    These are used when there is no cache yet and Gemini is unavailable,
    or when no transactions are loaded.
    """
    if df is None or df.empty:
        base = {
            "title": "Load transactions to unlock insights",
            "metric": "No data",
            "why": "No transactions are loaded yet, so insights cannot be computed.",
            "action": "Click Load Demo Data, then reopen AI insights.",
            "drilldown": {"type": "none", "value": ""},
        }
        return [base, base, base, base, base]

    dff = df.copy()

    if "posted_date" in dff.columns:
        dff["posted_date"] = pd.to_datetime(dff["posted_date"], errors="coerce")
        dff = dff.dropna(subset=["posted_date"])

    if month and "posted_date" in dff.columns:
        try:
            dff_month = dff[dff["posted_date"].astype(str).str.startswith(month)]
            if not dff_month.empty:
                dff = dff_month
        except Exception:
            pass

    resolved_month = month or (
        dff["posted_date"].max().strftime("%Y-%m") if "posted_date" in dff.columns and not dff.empty else "latest"
    )

    spend_cat = None
    spend_cat_amt = 0.0
    if "amount" in dff.columns and "category" in dff.columns:
        exp = dff[dff["amount"] < 0]
        if not exp.empty:
            by_cat = exp.groupby("category")["amount"].sum().abs().sort_values(ascending=False)
            if not by_cat.empty:
                spend_cat = str(by_cat.index[0])
                spend_cat_amt = float(by_cat.iloc[0])

    subs_count = 0
    subs_total = 0.0
    if "category" in dff.columns and "amount" in dff.columns:
        subs = dff[(dff["category"] == "Subscriptions") & (dff["amount"] < 0)]
        if not subs.empty:
            subs_total = float(subs["amount"].sum() * -1)
            if "merchant" in subs.columns:
                subs_count = int(subs["merchant"].nunique())

    anomaly_text = "None"
    if "amount" in dff.columns:
        dd = dff.copy()
        dd["abs_amount"] = dd["amount"].abs()
        spike = dd.sort_values("abs_amount", ascending=False).head(1)
        if not spike.empty:
            m = str(spike.iloc[0].get("merchant", ""))
            a = float(spike.iloc[0].get("abs_amount", 0.0))
            anomaly_text = f"{m} ${a:.2f}".strip()

    cards = [
        {
            "title": "Top spend category",
            "metric": f"${spend_cat_amt:.2f}" if spend_cat else "$0.00",
            "why": f"{spend_cat or 'No category'} is currently the largest spend area for {resolved_month}.",
            "action": "Open the category drilldown and target the top merchant first.",
            "drilldown": {"type": "category", "value": spend_cat or ""},
        },
        {
            "title": "Subscriptions overview",
            "metric": f"{subs_count} merchants" if subs_count else "No subscriptions",
            "why": f"Subscriptions spending for {resolved_month} is ${subs_total:.2f}.",
            "action": "Review recurring charges and cancel the least valuable item.",
            "drilldown": {"type": "subscriptions", "value": ""},
        },
        {
            "title": "Largest transaction check",
            "metric": anomaly_text,
            "why": "Large one time charges can distort your month and indicate unusual activity.",
            "action": "Verify the transaction and confirm it is expected.",
            "drilldown": {"type": "none", "value": ""},
        },
        {
            "title": "Dining and coffee nudge",
            "metric": "Opportunity",
            "why": "Small frequent purchases compound quickly across the month.",
            "action": "Cap dining or coffee once per week and track the monthly difference.",
            "drilldown": {"type": "category", "value": "Dining"},
        },
        {
            "title": "Quick win",
            "metric": "1 change",
            "why": "One cancellation or one category cap can produce a noticeable improvement.",
            "action": "Cancel one subscription or set a hard cap on your top category for the next 7 days.",
            "drilldown": {"type": "subscriptions", "value": ""},
        },
    ]

    return cards


def _get_best_cached_or_last_good(cache_key: str, month: str) -> Optional[Dict[str, Any]]:
    stale = _cache_get(cache_key, allow_stale=True)
    if stale is not None:
        return stale
    if month and month in _LAST_GOOD_BY_MONTH:
        return _LAST_GOOD_BY_MONTH.get(month)
    return _LAST_GOOD_GLOBAL


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
            model=_model_name(),
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
    """
    Generate 5 insight cards for a given month.

    Behavior:
    - Returns cached insights if available (fresh)
    - If Gemini fails, returns stale cached or last known good insights
    - If no cached insights exist yet, returns deterministic fallback cards from the data
    """
    month = (request.args.get("month") or "").strip()
    max_rows = _clamp_max_rows(request.args.get("max_rows", _MAX_ROWS_DEFAULT))

    df = STORE.transactions
    fallback_cards = _fallback_cards_from_df(df, month)

    if df is None or df.empty:
        out = {"cards": fallback_cards, "meta": {"ai_status": "no_data", "message": "No data loaded. Showing offline insights."}}
        return jsonify(out), 200

    if month and "posted_date" in df.columns:
        try:
            df2 = df[df["posted_date"].astype(str).str.startswith(month)]
            if not df2.empty:
                df = df2
        except Exception:
            pass

    cache_key = f"insights:{month}:{max_rows}:{len(df)}"
    cached = _cache_get(cache_key, allow_stale=False)
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
            model=_model_name(),
            contents=system_text + "\n\n" + json.dumps(prompt, default=str),
        )

        payload = _safe_json(resp.text or "")
        cards = payload.get("cards", []) if isinstance(payload, dict) else []

        cards = _ensure_five_cards(cards, fallback_cards)

        out = {"cards": cards, "meta": {"ai_status": "ok"}}
        _cache_set(cache_key, out)
        _remember_last_good(month, out)
        return jsonify(out), 200

    except ClientError as e:
        status = getattr(e, "status_code", None) or 500
        try:
            msg = str(e)
        except Exception:
            msg = "Gemini error"

        is_rate = status == 429 or "RESOURCE_EXHAUSTED" in msg

        best = _get_best_cached_or_last_good(cache_key, month)
        if best is not None:
            meta = dict(best.get("meta") or {})
            meta["ai_status"] = "cached"
            meta["message"] = "Gemini quota exceeded. Showing cached insights." if is_rate else "Gemini unavailable. Showing cached insights."
            out = {"cards": _ensure_five_cards(best.get("cards", []), fallback_cards), "meta": meta}
            _cache_set(cache_key, out)
            return jsonify(out), 200

        meta = {"ai_status": "fallback", "message": "Gemini unavailable. Showing offline insights."}
        out = {"cards": fallback_cards, "meta": meta}
        _cache_set(cache_key, out)
        return jsonify(out), 200

    except Exception as e:
        best = _get_best_cached_or_last_good(cache_key, month)
        if best is not None:
            meta = dict(best.get("meta") or {})
            meta["ai_status"] = "cached"
            meta["message"] = "AI request failed. Showing cached insights."
            out = {"cards": _ensure_five_cards(best.get("cards", []), fallback_cards), "meta": meta}
            _cache_set(cache_key, out)
            return jsonify(out), 200

        meta = {"ai_status": "fallback", "message": f"AI request failed. Showing offline insights. Details: {str(e)}"}
        out = {"cards": fallback_cards, "meta": meta}
        _cache_set(cache_key, out)
        return jsonify(out), 200
