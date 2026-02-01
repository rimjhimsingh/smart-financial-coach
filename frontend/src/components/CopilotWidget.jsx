/**
 * Copilot Widget
 * --------------
 * This module implements the persistent chat style AI assistant shown as a floating widget.
 *
 * What it renders:
 * - A floating toggle button anchored to the bottom right of the screen.
 * - A chat panel when open, including message history, a loading indicator, and an input box.
 * - Quick question chips that prefill the input with common prompts.
 *
 * How it works:
 * - postChat sends the user message to the backend /api/copilot/chat endpoint and expects a JSON
 *   response containing answer, bullets, and followups.
 * - The component maintains local state for open/closed UI, current input, loading state, and
 *   the chat transcript.
 * - When the panel opens or messages update, it auto scrolls to the latest message.
 * - send appends the user message, calls the API, and then appends the assistant response and
 *   optional follow up suggestions into the transcript.
 */
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
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen((v) => !v)}
          className={
            "group relative grid h-14 w-14 place-items-center rounded-2xl " +
            "border border-slate-700/60 bg-slate-950/40 shadow-lg backdrop-blur " +
            "transition active:scale-[0.98] " +
            (open ? "ring-2 ring-cyan-400/50" : "hover:ring-2 hover:ring-cyan-400/35")
          }
          title="Copilot"
          aria-label="Open Copilot"
        >
          <span className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-xl transition group-hover:opacity-100">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/60 via-cyan-400/40 to-blue-600/60" />
          </span>

          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600 opacity-90" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-transparent opacity-50" />

          <span className="relative grid place-items-center">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950/35 ring-1 ring-white/10">
              <span className="text-sm font-extrabold tracking-tight text-white">AI</span>
            </span>
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/90 shadow-2xl backdrop-blur">
          <div className="relative border-b border-slate-800/80 px-4 py-3">
            <div className="pointer-events-none absolute inset-0 opacity-80">
              <div className="absolute -top-20 -right-24 h-44 w-44 rounded-full bg-cyan-500/10 blur-2xl" />
              <div className="absolute -bottom-24 -left-24 h-52 w-52 rounded-full bg-blue-500/10 blur-2xl" />
            </div>

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-700/60 bg-slate-950/40">
                  <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">Fiscal Copilot</div>
                  <div className="text-xs text-slate-400">Personalized insights from your data</div>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/60"
              >
                Close
              </button>
            </div>
          </div>

          <div ref={listRef} className="h-80 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, idx) => (
              <Bubble key={idx} role={m.role} text={m.text} />
            ))}
            {loading ? <div className="text-xs text-slate-500">Thinking...</div> : null}
          </div>

          <div className="border-t border-slate-800/80 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Ask about spending, subscriptions, goals"
                className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
              />

              <button
                onClick={send}
                disabled={loading}
                className="rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600 px-4 py-2 text-sm font-extrabold text-slate-950 shadow-lg hover:brightness-110 disabled:opacity-60"
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
                  className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs text-slate-300 hover:bg-slate-900/60"
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
