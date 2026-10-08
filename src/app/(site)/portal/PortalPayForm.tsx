"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PortalPayForm({
  locationKey,
  ledgerId,
  amount,
}: {
  locationKey: string;
  ledgerId: number;
  amount: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError(undefined);
    const body = JSON.stringify({
      locationKey,
      ledgerId,
      ...Object.fromEntries(f),
    });
    (form.elements.namedItem("number") as HTMLInputElement).value = "";
    (form.elements.namedItem("cvv") as HTMLInputElement).value = "";
    const res = await fetch("/api/portal/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) {
      router.refresh();
      setOpen(false);
      setPending(false);
    } else {
      setError(data?.error ?? "We couldn't confirm your payment. Call (902) 867-3779.");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary btn-sm min-h-11" onClick={() => setOpen(true)}>
        Pay balance {amount}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 max-w-md space-y-3 rounded-xl border border-kv-line p-4" autoComplete="on">
      <p className="text-sm font-semibold text-kv-navy">Pay {amount}</p>
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
        <span className="label">Billing street</span>
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
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary btn-sm" disabled={pending}>
          {pending ? "Processing…" : `Pay ${amount}`}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
