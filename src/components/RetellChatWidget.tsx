"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { RetellWidgetConfig } from "@/lib/retell";

type Message = { role: "user" | "agent"; content: string };
type Conversation = { id: string; title: string; history: Message[]; ended?: boolean };
type Reply = { chat_id?: string; messages?: { role: string; content?: string; name?: string }[] };
const KEY = "kv-annie-conversations-v1";
const HELLO: Message = { role: "agent", content: "Hi, I’m Annie with KV Self Storage. How can I help you today?" };

/** Text chat uses Retell's public-key API, just like its embedded widget. */
export function RetellChatWidget(config: RetellWidgetConfig) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [menu, setMenu] = useState(false);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const chat = chats.find(c => c.id === current);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem("LS_CHAT_LIST") ?? "[]");
      if (Array.isArray(saved)) {
        const valid = saved.filter((c): c is Conversation => Boolean(c && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.history) && c.history.every((m: Message) => m && ["user", "agent"].includes(m.role) && typeof m.content === "string")));
        setChats(valid); setCurrent(valid[0]?.id ?? null);
      }
    } catch { /* Storage can be unavailable in private browsers. */ }
    setReady(true);
    function firstClick() {
      try { if (sessionStorage.getItem("kv-annie-dismissed")) return; } catch {}
      setPreview(true);
    }
    document.addEventListener("click", firstClick, { once: true });
    return () => document.removeEventListener("click", firstClick);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch {}
  }, [chats, ready]);
  useEffect(() => { if (open && !menu) input.current?.focus({ preventScroll: true }); }, [open, menu]);
  useEffect(() => { if (open) bottom.current?.scrollIntoView({ block: "nearest" }); }, [chat?.history.length, busy, open]);

  function dismiss() {
    setPreview(false);
    try { sessionStorage.setItem("kv-annie-dismissed", "1"); } catch {}
  }
  function show() { dismiss(); setOpen(true); }
  async function request(path: string, body: object, captcha = false): Promise<Reply> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${config.publicKey}` };
    if (captcha && config.recaptchaKey) {
      const recaptcha = (window as unknown as { grecaptcha?: { ready: (cb: () => void) => void; execute: (key: string, args: { action: string }) => Promise<string> } }).grecaptcha;
      if (!recaptcha) throw new Error("Chat is still loading. Please try again.");
      await new Promise<void>(resolve => recaptcha.ready(resolve));
      headers["g-recaptcha-response"] = await recaptcha.execute(config.recaptchaKey, { action: "submit" });
    }
    const response = await fetch(`https://api.retellai.com${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error("Annie couldn’t reply. Please try again, or call (902) 867-3779.");
    return response.json();
  }
  async function send() {
    const text = draft.trim();
    if (!text || locked.current || chat?.ended) return;
    locked.current = true; setBusy(true); setError(""); setDraft("");
    let id = current;
    try {
      if (!id) {
        const created = await request("/create-chat", { agent_id: config.chatAgentId, ...(config.agentVersion ? { agent_version: Number(config.agentVersion) } : {}) }, true);
        if (!created.chat_id) throw new Error("Unable to start chat. Please try again.");
        id = created.chat_id;
        // Initialize the conversation flow before submitting the visitor's first turn,
        // matching Retell's embedded widget sequence.
        const greeting = await request("/create-chat-completion", { chat_id: id, content: "" });
        const initial = (greeting.messages ?? []).filter(m => m.role === "agent" && typeof m.content === "string").map(m => ({ role: "agent" as const, content: m.content! }));
        setCurrent(id);
        setChats(prev => [{ id: id!, title: text.slice(0, 50), history: initial.length ? initial : [HELLO] }, ...prev]);
      }
      const activeId = id;
      setChats(prev => prev.map(c => c.id === activeId ? { ...c, history: [...c.history, { role: "user", content: text }] } : c));
      const reply = await request("/create-chat-completion", { chat_id: id, content: text });
      const messages = (reply.messages ?? []).filter(m => m.role === "agent" && typeof m.content === "string").map(m => ({ role: "agent" as const, content: m.content! }));
      setChats(prev => prev.map(c => c.id === activeId ? { ...c, history: [...c.history, ...messages], ended: reply.messages?.some(m => m.role === "tool_call_invocation" && m.name === "end_call") } : c));
    } catch (e) {
      const failedId = id;
      setChats(prev => prev.map(c => c.id === failedId && c.history.at(-1)?.role === "user" && c.history.at(-1)?.content === text ? { ...c, history: c.history.slice(0, -1) } : c));
      setError(e instanceof Error ? e.message : "Unable to send. Please try again.");
      setDraft(prev => prev || text);
    } finally { locked.current = false; setBusy(false); }
  }

  return <>
    {config.recaptchaKey && <Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(config.recaptchaKey)}`} strategy="lazyOnload" />}
    {config.voiceAgentId && <Script id="retell-widget" src="https://dashboard.retellai.com/retell-widget-v2.js" type="module" strategy="lazyOnload" data-voice-public-key={config.voicePublicKey || config.publicKey} data-voice-agent-id={config.voiceAgentId} data-title="Talk to Annie" data-fab-text="Talk to Annie" data-show-ai-popup="false" data-theme-color="#1a2a3b" data-component-color="#790909" data-recaptcha-key={config.recaptchaKey} />}
    {config.voiceAgentId && <style>{`#retell-widget-root { right: auto !important; left: 16px; }`}</style>}
    <div className="fixed bottom-4 right-4 z-[999999] max-w-[calc(100vw-2rem)]" onClick={e => e.stopPropagation()}>
      {!open && preview && <div className="relative mb-3 ml-auto w-60 overflow-hidden rounded-[2rem] border-[5px] border-kv-navy bg-slate-50 shadow-2xl">
        <button aria-label="Dismiss Annie’s invitation" onClick={dismiss} className="absolute right-1 top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-kv-navy">×</button>
        <button onClick={show} className="w-full text-left" aria-label="Open chat with Annie">
          <div className="bg-kv-navy px-4 py-3 pr-12 text-white"><span className="font-semibold">Annie</span><span className="block text-xs text-white/80">KV Self Storage · AI assistant</span></div>
          <div className="p-4"><p className="rounded-2xl rounded-bl-sm bg-white p-3 text-sm text-slate-800 shadow-sm">Hey! Need a hand? Tap here to ask me a question.</p><span className="mt-3 block rounded-full bg-kv-navy px-3 py-2 text-center text-xs text-white">Chat with Annie ↗</span></div>
        </button>
      </div>}
      {open && <section aria-label="Chat with Annie" onKeyDown={e => { if (e.key === "Escape") { setOpen(false); setMenu(false); } }} className="mb-3 flex h-[min(620px,calc(100dvh-110px))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] border-[5px] border-kv-navy bg-slate-50 shadow-2xl motion-safe:animate-[annie-open_180ms_ease-out]">
        <header className="flex items-center gap-3 bg-kv-navy p-4 text-white"><div className="flex-1"><strong>Annie</strong><p className="text-xs text-white/75">KV Self Storage · AI assistant</p></div><button onClick={() => setMenu(!menu)} aria-label="Conversation history" aria-expanded={menu} className="h-10 w-10 rounded-full hover:bg-white/10">•••</button><button onClick={() => { setOpen(false); setMenu(false); }} aria-label="Close chat" className="h-10 w-10 rounded-full text-2xl hover:bg-white/10">×</button></header>
        {menu ? <div className="flex-1 overflow-y-auto p-4"><button disabled={busy} className="mb-4 w-full rounded-full bg-kv-navy p-3 text-white disabled:opacity-50" onClick={() => { setCurrent(null); setDraft(""); setError(""); setMenu(false); }}>Start a new conversation</button><p className="mb-3 text-xs text-slate-500">Saved on this browser. Removing a chat here does not delete the business’s records.</p>{chats.map(c => <div key={c.id} className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><button disabled={busy} onClick={() => { setCurrent(c.id); setMenu(false); setError(""); }} className="min-w-0 flex-1 truncate p-2 text-left text-sm">{c.title || "Conversation"}</button><button disabled={busy} aria-label={`Remove conversation: ${c.title || "Conversation"}`} className="rounded-lg p-2 text-sm text-red-800 disabled:opacity-40" onClick={() => { setChats(prev => prev.filter(x => x.id !== c.id)); if (current === c.id) setCurrent(null); }}>Remove</button></div>)}</div> : <>
          <div className="flex-1 overflow-y-auto p-4" aria-live="polite">{(chat?.history ?? [HELLO]).map((m, i) => <p key={i} className={`mb-3 max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "ml-auto rounded-br-sm bg-kv-navy text-white" : "rounded-bl-sm bg-white text-slate-800 shadow-sm"}`}>{m.content.split(/(https?:\/\/[^\s)\]]+)/g).map((part, j) => /^https?:\/\//.test(part) ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="underline">{part}</a> : part)}</p>)}{busy && <p className="text-sm text-slate-500">Annie is typing…</p>}<div ref={bottom} /></div>
          {error && <p role="alert" className="px-4 py-2 text-sm text-red-800">{error}</p>}
          {chat?.ended ? <button onClick={() => { setCurrent(null); setDraft(""); }} className="m-3 rounded-full bg-kv-navy p-3 text-white">Start a new conversation</button> : <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"><textarea ref={input} aria-label="Message Annie" placeholder="Message Annie…" rows={2} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} className="max-h-28 min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-kv-navy" /><button type="submit" disabled={busy || !draft.trim()} aria-label="Send message" className="h-11 w-11 rounded-full bg-kv-navy text-xl text-white disabled:opacity-40">↑</button></form>}
          <a href="https://www.retellai.com/" target="_blank" rel="noopener noreferrer" className="bg-white pb-2 text-center text-[10px] text-slate-500">Powered by Retell</a>
        </>}
      </section>}
      <button onClick={() => open ? setOpen(false) : show()} aria-expanded={open} aria-label={open ? "Minimize Annie chat" : "Open chat with Annie"} className="ml-auto block rounded-full bg-kv-navy px-5 py-3 font-semibold text-white shadow-xl">{open ? "Minimize" : "Chat with Annie"}</button>
    </div>
    <style>{`@keyframes annie-open { from { opacity: 0; transform: scale(.85) translateY(20px); transform-origin: bottom right; } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
  </>;
}
