import { useEffect, useRef, useState } from "react";

async function postChat(message) {
  const res = await fetch("/api/copilot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, max_rows: 300 }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

function Bubble({ role, text }) {
  const isUser = role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm " +
          (isUser
            ? "bg-slate-200 text-slate-950"
            : "bg-slate-900 text-slate-100 border border-slate-800")
        }
      >
        {text}
      </div>
    </div>
  );
}

export default function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Ask me about spending, subscriptions, anomalies, or how to save toward a goal.",
    },
  ]);

  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  }, [open, messages, loading]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const data = await postChat(msg);

      const assistantText =
        (data.answer || "").trim() ||
        (Array.isArray(data.bullets) ? data.bullets.join("\n") : "") ||
        "I could not generate an answer.";

      setMessages((m) => [...m, { role: "assistant", text: assistantText }]);

      if (Array.isArray(data.followups) && data.followups.length) {
        const followText = "Follow ups:\n" + data.followups.map((x) => `- ${x}`).join("\n");
        setMessages((m) => [...m, { role: "assistant", text: followText }]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Error contacting Copilot. Check backend and API key." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-slate-200 text-slate-950 shadow-lg hover:bg-white"
        title="Copilot"
      >
        AI
      </button>

      {open ? (
        <div className="fixed bottom-20 right-5 z-50 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <div className="text-sm font-extrabold text-white">Fiscal Copilot</div>
              <div className="text-xs text-slate-400">Personalized insights from your data</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-900"
            >
              Close
            </button>
          </div>

          <div ref={listRef} className="h-80 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, idx) => (
              <Bubble key={idx} role={m.role} text={m.text} />
            ))}
            {loading ? <div className="text-xs text-slate-500">Thinking...</div> : null}
          </div>

          <div className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Ask about spending, subscriptions, goals"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
              />
              <button
                onClick={send}
                disabled={loading}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-60"
              >
                Send
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {[
                "What changed this month?",
                "What can I cancel to save money?",
                "Why was this flagged as an anomaly?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300 hover:bg-slate-900"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
