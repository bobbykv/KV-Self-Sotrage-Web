"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LeadForm } from "./LeadForm";

type Action =
  | { type: "lead_form"; reason: "unavailable_unit" | "waitlist" | "contact_request" | "human_handoff"; locationKey?: string; unitType?: string; unitSize?: string }
  | { type: "call" }
  | { type: "link"; href: string; label: string };
type Msg = { role: "user" | "assistant"; content: string; actions?: Action[] };

const PHONE = "(902) 867-3779";
const STORAGE_KEY = "kv-chat-v1";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMsgs(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-20)));
    } catch {
      /* ignore */
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(history: Msg[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setMsgs([...history, { role: "assistant", content: data.reply ?? `I couldn’t get an answer just now. For help, call ${PHONE}.`, actions: data.actions ?? [] }]);
    } catch {
      setMsgs([...history, { role: "assistant", content: `I'm having trouble connecting. Please call us at ${PHONE}.`, actions: [{ type: "call" }] }]);
    } finally {
      setBusy(false);
    }
  }

  function openChat() {
    setOpen(true);
    if (!msgs.length) void send([]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    void send(next);
  }

  return (
    <>
      {!open && (
        <button onClick={openChat} className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-kv-navy px-5 py-3.5 font-semibold text-white shadow-xl hover:bg-kv-navy-light" aria-label="Open chat assistant">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
          </svg>
          Questions? Chat
        </button>
      )}
      {open && (
        <section
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-kv-line bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[600px] sm:w-[390px] sm:rounded-3xl"
          aria-label="KV Self Storage chat assistant"
        >
          <header className="flex items-center justify-between bg-kv-navy px-4 py-3 text-white">
            <div>
              <p className="font-bold">KV Self Storage assistant</p>
              <p className="text-xs text-white/75">Virtual assistant · ask for a callback</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close chat">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-kv-navy-50/60 p-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${m.role === "user" ? "bg-kv-red text-white" : "border border-kv-line bg-white text-kv-ink"}`}>{m.content}</div>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.actions.map((a, j) =>
                      a.type === "link" ? (
                        <Link key={j} href={a.href} className="rounded-full border border-kv-navy bg-white px-3 py-1.5 text-xs font-semibold text-kv-navy hover:bg-kv-navy hover:text-white">
                          {a.label}
                        </Link>
                      ) : a.type === "call" ? (
                        <a key={j} href="tel:+19028673779" className="rounded-full bg-kv-red px-3 py-1.5 text-xs font-semibold text-white">
                          Call {PHONE}
                        </a>
                      ) : (
                        <div key={j} className="w-full rounded-2xl border border-kv-line bg-white p-3">
                          <LeadForm
                            compact
                            channel="website_chat"
                            reason={a.reason}
                            locationKey={a.locationKey}
                            unitType={a.unitType}
                            unitSize={a.unitSize}
                            title={a.reason === "human_handoff" ? "Have someone call me" : a.reason === "unavailable_unit" ? "Tell me when one opens" : "Leave your details"}
                            submitLabel="Send"
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-xs text-kv-muted">Typing…</p>}
          </div>

          <form onSubmit={submit} className="flex gap-2 border-t border-kv-line p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="What are you storing?"
              className="input min-h-11 flex-1 rounded-full"
              aria-label="Message"
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-primary btn-sm min-h-11">
              Send
            </button>
          </form>
          <p className="px-4 pb-3 text-[11px] text-kv-muted">Please don&apos;t share card numbers here. Need a person? Call {PHONE}.</p>
        </section>
      )}
    </>
  );
}
