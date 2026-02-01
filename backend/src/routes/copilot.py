import json
from flask import Blueprint, jsonify, request

from ..services.store import STORE
from ..services.gemini_client import get_gemini_client

copilot_bp = Blueprint("copilot", __name__)

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

    # For a hackathon: send the last N rows as context
    data = df.to_dict(orient="records")
    if len(data) > max_rows:
        data = data[-max_rows:]

    prompt = {
        "question": message,
        "transactions": data,
        "output_format": {
            "answer": "string",
            "bullets": ["string"],
            "followups": ["string"]
        }
    }

    system_text = (
        "You are a personal finance assistant. "
        "Use the provided transactions to answer. "
        "Return ONLY valid JSON. No markdown. No extra text. "
        "JSON keys: answer, bullets, followups."
    )

    client = get_gemini_client()
    resp = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=system_text + "\n\n" + json.dumps(prompt, default=str),
    )

    text = (resp.text or "").strip()

    # Parse JSON, recover if Gemini wraps it with text
    try:
        return jsonify(json.loads(text)), 200
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return jsonify(json.loads(text[start:end + 1])), 200
        return jsonify({"error": "Model did not return valid JSON", "raw": text}), 502

@copilot_bp.get("/copilot/insights")
def copilot_insights():
    month = request.args.get("month")
    max_rows = int(request.args.get("max_rows", 300))

    df = STORE.transactions
    if df is None or df.empty:
        return jsonify({"cards": []}), 200

    # Optional: filter by month if you store a posted_date column like "YYYY-MM-DD"
    if month and "posted_date" in df.columns:
        try:
            # month expected "YYYY-MM"
            df2 = df[df["posted_date"].astype(str).str.startswith(month)]
            if not df2.empty:
                df = df2
        except Exception:
            pass

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
                    "drilldown": {"type": "string", "value": "string"}
                }
            ]
        }
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

    client = get_gemini_client()
    resp = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=system_text + "\n\n" + json.dumps(prompt, default=str),
    )

    text = (resp.text or "").strip()

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            payload = json.loads(text[start:end + 1])
        else:
            return jsonify({"error": "Model did not return valid JSON", "raw": text}), 502

    cards = payload.get("cards", [])
    if not isinstance(cards, list):
        cards = []

    return jsonify({"cards": cards[:5]}), 200
