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
