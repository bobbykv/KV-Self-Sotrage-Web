"use client";

import { useState } from "react";

type Props = {
  reason: "unavailable_unit" | "waitlist" | "contact_request" | "human_handoff";
  channel?: "website_form" | "website_chat";
  locationKey?: string;
  unitType?: string;
  unitSize?: string;
  compact?: boolean;
  title?: string;
  submitLabel?: string;
};

export function LeadForm({ reason, channel = "website_form", locationKey, unitType, unitSize, compact, title, submitLabel = "Let me know" }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        reason,
        name: f.get("name"),
        phone: f.get("phone"),
        email: f.get("email"),
        locationKey: f.get("locationKey") || locationKey || undefined,
        unitType,
        unitSize: f.get("unitSize") || unitSize || undefined,
        notes: f.get("notes") || undefined,
        website: f.get("website"),
      }),
    }).catch(() => null);
    if (res?.ok) setState("done");
    else {
      setState("error");
      setError((await res?.json().catch(() => null))?.error ?? "Something went wrong. Please call (902) 867-3779.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-kv-navy-50 p-4 text-sm text-kv-navy" role="status">
        <p className="font-bold">Thanks — you&apos;re on our list.</p>
        <p>Someone from KV will be in touch. If it&apos;s urgent, call (902) 867-3779.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      {title && <p className="font-bold text-kv-navy">{title}</p>}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input name="name" required placeholder="Your name" autoComplete="name" className="input" aria-label="Your name" />
      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        <input name="phone" type="tel" placeholder="Phone" autoComplete="tel" className="input" aria-label="Phone" />
        <input name="email" type="email" placeholder="Email" autoComplete="email" className="input" aria-label="Email" />
      </div>
      {!locationKey && !compact && (
        <select name="locationKey" className="input" aria-label="Preferred location" defaultValue="">
          <option value="">Any location</option>
          <option value="haley">Haley Road, Antigonish</option>
          <option value="hwy4">Addington Forks (Hwy 4 / Exit 31)</option>
          <option value="stellarton">Stellarton</option>
        </select>
      )}
      {!unitSize && !compact && <input name="unitSize" placeholder="Size you need (e.g. 10x10) — optional" className="input" aria-label="Size" />}
      <textarea name="notes" rows={compact ? 2 : 3} placeholder="Anything else? (optional)" className="input py-3" aria-label="Notes" />
      {error && <p className="text-sm font-semibold text-kv-red">{error}</p>}
      <button type="submit" disabled={state === "sending"} className={`btn-primary w-full ${compact ? "btn-sm min-h-11" : ""}`}>
        {state === "sending" ? "Sending…" : submitLabel}
      </button>
      <p className="text-xs text-kv-muted">We&apos;ll only use this to contact you about storage. Phone or email required.</p>
    </form>
  );
}
