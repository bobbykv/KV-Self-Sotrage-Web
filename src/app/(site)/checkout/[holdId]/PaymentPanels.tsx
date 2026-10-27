"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const CHECKOUT_FORM_ID = "checkout-form";

export function PaySeparatelyPanel({
  holdId,
  hours,
  payOnlineUrl,
  recurringNote,
}: {
  holdId: string;
  hours: number;
  payOnlineUrl?: string;
  recurringNote: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    if (!String(fields.get("idPhoto") || "")) {
      setError("Add a photo of your driver's license or government ID.");
      return;
    }
    setPending(true);
    setError(undefined);
    const res = await fetch(`/api/checkout/${holdId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fields)),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/checkout/${holdId}/confirmation`);
    else {
      setError(data?.error ?? "We couldn't confirm your reservation. Try again or call (902) 867-3779.");
      setPending(false);
    }
  }

  return (
    <form id={CHECKOUT_FORM_ID} onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl bg-kv-navy-50 p-4 text-sm text-kv-navy">
        <p>
          Reserve this unit for {hours} hours while you finish payment and your rental. Confirming the reservation does not take a payment. Your confirmation tells you what to do next.
        </p>
        <p className="mt-2 font-semibold">{recurringNote}</p>
      </div>
      {error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Confirming your reservation..." : "Confirm my reservation"}
      </button>
      {payOnlineUrl && (
        <a href={payOnlineUrl} className="btn-ghost w-full" target="_blank" rel="noopener noreferrer">
          Continue to payment
        </a>
      )}
    </form>
  );
}

/**
 * PAYMENT_MODE=passthrough only. Card fields are posted once to our
 * server-only pay route, which forwards them to SiteLink. Nothing is kept in
 * browser storage, and the card fields are cleared after every attempt.
 * The ID photo is a data URL in the same request and is not stored here.
 */
export function CardPaymentForm({ holdId, total, recurringNote }: { holdId: string; total: string; recurringNote: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (!String(f.get("idPhoto") || "")) {
      setError("Add a photo of your driver's license or government ID.");
      return;
    }
    setPending(true);
    setError(undefined);
    const body = JSON.stringify(Object.fromEntries(f));
    (form.elements.namedItem("number") as HTMLInputElement).value = "";
    (form.elements.namedItem("cvv") as HTMLInputElement).value = "";
    const res = await fetch(`/api/checkout/${holdId}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/checkout/${holdId}/confirmation`);
    else {
      setError(data?.error ?? "We couldn't confirm your payment. Call (902) 867-3779 before trying again so we can check it.");
      setPending(false);
    }
  }

  return (
    <form id={CHECKOUT_FORM_ID} onSubmit={onSubmit} className="space-y-3" autoComplete="on">
      <h3 className="font-extrabold text-kv-navy">Card payment</h3>
      <p className="rounded-xl bg-kv-navy-50 p-3 text-sm font-semibold text-kv-navy">{recurringNote}</p>
      <label className="block">
        <span className="label">Name on card</span>
        <input name="name" required autoComplete="cc-name" className="input" />
      </label>
      <label className="block">
        <span className="label">Card number</span>
        <input name="number" required inputMode="numeric" autoComplete="cc-number" placeholder="•••• •••• •••• ••••" className="input font-mono" maxLength={23} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Expiry date (MM/YY)</span>
          <input name="expiry" required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" className="input font-mono" maxLength={7} />
        </label>
        <label>
          <span className="label">Security code</span>
          <input name="cvv" required inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" className="input font-mono" maxLength={4} />
        </label>
      </div>
      <label className="block">
        <span className="label">Billing street address</span>
        <input name="street" required autoComplete="section-billing street-address" className="input" />
      </label>
      <label className="block">
        <span className="label">Billing postal code</span>
        <input name="postal" required autoComplete="section-billing postal-code" className="input uppercase" maxLength={7} />
      </label>
      {error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Processing payment..." : `Pay ${total} and complete my rental`}
      </button>
      <p className="text-xs text-kv-muted">After payment you get a link to sign your SiteLink lease, then your unit access instructions.</p>
    </form>
  );
}
