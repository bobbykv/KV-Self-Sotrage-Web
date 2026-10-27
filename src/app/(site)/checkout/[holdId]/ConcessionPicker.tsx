"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STANDARD_BILLING_LABEL } from "@/lib/sitelink/concessions";

export type CheckoutPlan = {
  concessionId: number;
  name: string;
  description: string;
  prepay: boolean;
  prepaidMonths: number;
};

export function ConcessionPicker({
  holdId,
  formId,
  plans,
  selectedId,
}: {
  holdId: string;
  formId: string;
  plans: CheckoutPlan[];
  selectedId: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(selectedId);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setSelected(selectedId);
  }, [selectedId]);
  const [error, setError] = useState<string>();

  async function choose(next: number | null) {
    const previous = selected;
    setSelected(next);
    setPending(true);
    setError(undefined);
    const res = await fetch(`/api/checkout/${holdId}/concession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concessionId: next }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setSelected(previous);
      setError(data?.error ?? "We couldn't update your billing plan. Please try again.");
      setPending(false);
      return;
    }
    router.refresh();
    setPending(false);
  }

  return (
    <fieldset className="mt-6 space-y-3">
      <legend className="font-extrabold text-kv-navy">Billing plan</legend>
      <p className="text-sm text-kv-muted">KV bills every 28 days. Choose standard billing, or a prepaid package when one applies to this unit.</p>
      <label className="flex items-start gap-3 rounded-xl border border-kv-line p-3 text-sm">
        <input type="radio" name="billingPlan" className="mt-1" checked={selected === null} onChange={() => choose(null)} disabled={pending} />
        <span>
          <span className="font-semibold text-kv-navy">{STANDARD_BILLING_LABEL}</span>
          <span className="mt-0.5 block text-kv-muted">One 28-day period due at move-in, then the same card is billed every 28 days.</span>
        </span>
      </label>
      {plans.map((plan) => (
        <label key={plan.concessionId} className="flex items-start gap-3 rounded-xl border border-kv-line p-3 text-sm">
          <input
            type="radio"
            name="billingPlan"
            className="mt-1"
            checked={selected === plan.concessionId}
            onChange={() => choose(plan.concessionId)}
            disabled={pending}
          />
          <span>
            <span className="font-semibold text-kv-navy">{plan.name}</span>
            {plan.description && <span className="mt-0.5 block text-kv-muted">{plan.description}</span>}
            {plan.prepay && plan.prepaidMonths > 1 && (
              <span className="mt-0.5 block text-kv-muted">Prepaid for {plan.prepaidMonths} billing periods. Automatic 28-day billing starts after that.</span>
            )}
          </span>
        </label>
      ))}
      <input form={formId} type="hidden" name="concessionId" value={selected ?? ""} />
      {pending && <p className="text-sm text-kv-muted">Updating your total…</p>}
      {error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
