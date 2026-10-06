"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmReservation } from "./actions";

export function PaySeparatelyPanel({ holdId, hours, payOnlineUrl }: { holdId: string; hours: number; payOnlineUrl?: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-kv-navy-50 p-4 text-sm text-kv-navy">
        <p className="font-bold">How payment works right now</p>
        <p className="mt-1">
          Confirm below and we&apos;ll keep this unit reserved for you for {hours} hours. Our office will contact you to take payment and finish your move-in
          {payOnlineUrl ? ", or you can pay through our secure online payment page" : ""}. Nothing is charged on this website.
        </p>
      </div>
      {error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn-primary w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await confirmReservation(holdId);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Confirming…" : "Confirm my reservation"}
      </button>
    </div>
  );
}

/**
 * PAYMENT_MODE=passthrough only. Card fields are posted once to our
 * server-only pay route, which forwards them to SiteLink. Nothing is kept in
 * browser storage, and the fields are cleared after every attempt.
 */
export function CardPaymentForm({ holdId, total }: { holdId: string; total: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError(undefined);
    const body = JSON.stringify(Object.fromEntries(f));
    (form.elements.namedItem("number") as HTMLInputElement).value = "";
    (form.elements.namedItem("cvv") as HTMLInputElement).value = "";
    const res = await fetch(`/api/checkout/${holdId}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/checkout/${holdId}/confirmation`);
    else {
      setError(data?.error ?? "The payment didn't go through and nothing was charged.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
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
          <span className="label">Expiry (MM/YY)</span>
          <input name="expiry" required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" className="input font-mono" maxLength={7} />
        </label>
        <label>
          <span className="label">Security code</span>
          <input name="cvv" required inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" className="input font-mono" maxLength={4} />
        </label>
      </div>
      <label className="block">
        <span className="label">Billing street address</span>
        <input name="street" required autoComplete="address-line1" className="input" />
      </label>
      <label className="block">
        <span className="label">Postal code</span>
        <input name="postal" required autoComplete="postal-code" className="input uppercase" maxLength={7} />
      </label>
      {error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Processing…" : `Pay ${total} and move in`}
      </button>
      <p className="text-xs text-kv-muted">Your card is sent securely to our booking and payment system (SiteLink). We never store your card details.</p>
    </form>
  );
}
