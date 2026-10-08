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

export function LeadForm({
  reason,
  channel = "website_form",
  locationKey,
  unitType,
  unitSize,
  compact,
  title,
  submitLabel = "Join the waitlist",
  notesPlaceholder = "What are you storing, or how can we help? (optional)",
}: Props & { notesPlaceholder?: string }) {
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
      setError((await res?.json().catch(() => null))?.error ?? (reason === "waitlist" || reason === "unavailable_unit" ? "We couldn't add you to the waitlist. Try again or call (902) 867-3779." : "We couldn't send your message. Try again, call (902) 867-3779 or email info@kvselfstorage.ca."));
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-kv-navy-50 p-4 text-sm text-kv-navy" role="status">
        <p className="font-bold">{reason === "waitlist" || reason === "unavailable_unit" ? "You're on the waitlist. We'll contact you when a matching space opens." : reason === "human_handoff" ? "Your callback request has been sent." : "Your message has been sent. We'll get back to you."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      {title && <p className="font-bold text-kv-navy">{title}</p>}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input name="name" required placeholder="Name" autoComplete="name" className="input" aria-label="Name" />
      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        <input name="phone" type="tel" placeholder={reason === "contact_request" ? "Phone (optional)" : "Phone"} autoComplete="tel" className="input" aria-label="Phone" />
        <input name="email" type="email" placeholder="Email" autoComplete="email" className="input" aria-label="Email" />
      </div>
      {!locationKey && !compact && (
        <select name="locationKey" className="input" aria-label="Location" defaultValue="">
          <option value="">Location</option>
          <option value="haley">Haley Road, Antigonish</option>
          <option value="hwy4">Addington Forks, Exit 31</option>
          <option value="stellarton">Stellarton, Heritage Avenue</option>
        </select>
      )}
      {!unitSize && !compact && <input name="unitSize" placeholder="Size needed" className="input" aria-label="Size needed" />}
      <textarea name="notes" rows={compact ? 2 : 3} placeholder={notesPlaceholder} className="input py-3" aria-label={reason === "contact_request" ? "What can we help with?" : "Notes"} />
      {error && <p className="text-sm font-semibold text-kv-red">{error}</p>}
      <button type="submit" disabled={state === "sending"} className={`btn-primary w-full ${compact ? "btn-sm min-h-11" : ""}`}>
        {state === "sending" ? (reason === "contact_request" ? "Sending..." : "Sending…") : submitLabel}
      </button>
      {!compact && <p className="text-xs text-kv-muted">Add a phone number or email so we can follow up.</p>}
    </form>
  );
}
