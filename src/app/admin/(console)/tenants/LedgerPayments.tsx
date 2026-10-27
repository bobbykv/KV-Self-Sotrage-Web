"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationKey } from "@/config/locations";
import { money } from "@/lib/catalog";

export function LedgerPayments({
  locationKey,
  tenantId,
  ledgerId,
  unitId,
  unitName,
  balance,
  rent,
  autopay,
}: {
  locationKey: LocationKey;
  tenantId: number;
  ledgerId: number;
  unitId: number;
  unitName: string;
  balance: number;
  rent: number;
  autopay: boolean;
}) {
  return (
    <div className="mt-4 space-y-4 border-t border-kv-line pt-4">
      <PaymentForm locationKey={locationKey} tenantId={tenantId} ledgerId={ledgerId} unitId={unitId} unitName={unitName} balance={balance} rent={rent} />
      <BillingForm locationKey={locationKey} ledgerId={ledgerId} autopay={autopay} />
    </div>
  );
}

function PaymentForm({
  locationKey,
  tenantId,
  ledgerId,
  unitId,
  unitName,
  balance,
  rent,
}: {
  locationKey: LocationKey;
  tenantId: number;
  ledgerId: number;
  unitId: number;
  unitName: string;
  balance: number;
  rent: number;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"card" | "cash" | "check">("card");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const defaultAmount = (balance > 0 ? balance : rent).toFixed(2);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    const data = new FormData(event.currentTarget);
    const body = {
      action: "pay",
      locationKey,
      tenantId,
      ledgerId,
      unitId,
      unitName,
      method,
      amount: Number(data.get("amount")),
      checkNumber: String(data.get("checkNumber") ?? ""),
      saveCard: data.get("saveCard") === "on",
      card:
        method === "card"
          ? {
              number: String(data.get("cardNumber") ?? ""),
              cvv: String(data.get("cvv") ?? ""),
              expiry: String(data.get("expiry") ?? ""),
              name: String(data.get("billingName") ?? ""),
              street: String(data.get("billingStreet") ?? ""),
              postal: String(data.get("billingPostal") ?? ""),
            }
          : undefined,
    };
    const res = await fetch("/api/admin/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const payload = await res?.json().catch(() => null);
    setPending(false);
    if (!res?.ok) {
      setError(payload?.error ?? "SiteLink did not take that payment.");
      return;
    }
    const receipt = payload.receiptId ? ` Receipt ${payload.receiptId}.` : "";
    setNotice(`${money(body.amount)} ${method} payment recorded.${receipt}${payload.autoBillError ? ` ${payload.autoBillError}` : payload.autoBillEnabled ? " Card saved for 28-day auto-bill." : ""}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-2">
      <p className="font-bold text-kv-navy sm:col-span-2">Take payment</p>
      <label className="text-xs font-semibold text-kv-navy">
        Amount
        <input name="amount" defaultValue={defaultAmount} inputMode="decimal" className="input mt-1" required />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Method
        <select className="input mt-1" value={method} onChange={(event) => setMethod(event.target.value as "card" | "cash" | "check")}>
          <option value="card">Credit card</option>
          <option value="cash">Cash</option>
          <option value="check">Check / e-transfer</option>
        </select>
      </label>
      {method === "check" && (
        <label className="text-xs font-semibold text-kv-navy sm:col-span-2">
          Check number or e-transfer reference
          <input name="checkNumber" className="input mt-1" required />
        </label>
      )}
      {method === "card" && (
        <>
          <label className="text-xs font-semibold text-kv-navy">
            Card number
            <input name="cardNumber" inputMode="numeric" autoComplete="off" className="input mt-1" required />
          </label>
          <label className="text-xs font-semibold text-kv-navy">
            Expiry (MM/YY)
            <input name="expiry" autoComplete="off" placeholder="MM/YY" className="input mt-1" required />
          </label>
          <label className="text-xs font-semibold text-kv-navy">
            Security code
            <input name="cvv" inputMode="numeric" autoComplete="off" className="input mt-1" required />
          </label>
          <label className="text-xs font-semibold text-kv-navy">
            Name on card
            <input name="billingName" className="input mt-1" required />
          </label>
          <label className="text-xs font-semibold text-kv-navy">
            Billing street
            <input name="billingStreet" className="input mt-1" required />
          </label>
          <label className="text-xs font-semibold text-kv-navy">
            Billing postal code
            <input name="billingPostal" className="input mt-1" required />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="saveCard" />
            Save card for 28-day auto-bill
          </label>
        </>
      )}
      <div className="sm:col-span-2">
        <button className="btn-navy btn-sm" disabled={pending}>
          {pending ? "Processing…" : "Take payment"}
        </button>
      </div>
      {error && <p className="text-sm text-kv-red sm:col-span-2">{error}</p>}
      {notice && <p className="text-sm font-semibold text-kv-navy sm:col-span-2">{notice}</p>}
    </form>
  );
}

function BillingForm({ locationKey, ledgerId, autopay }: { locationKey: LocationKey; ledgerId: number; autopay: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function send(autoBill: boolean, form?: HTMLFormElement) {
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    const data = form ? new FormData(form) : null;
    const body = {
      action: "billing",
      locationKey,
      ledgerId,
      autoBill,
      card: autoBill
        ? {
            number: String(data?.get("cardNumber") ?? ""),
            cvv: String(data?.get("cvv") ?? ""),
            expiry: String(data?.get("expiry") ?? ""),
            name: String(data?.get("billingName") ?? ""),
            street: String(data?.get("billingStreet") ?? ""),
            postal: String(data?.get("billingPostal") ?? ""),
          }
        : undefined,
    };
    const res = await fetch("/api/admin/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const payload = await res?.json().catch(() => null);
    setPending(false);
    if (!res?.ok) {
      setError(payload?.error ?? "SiteLink did not update the card on file.");
      return;
    }
    setNotice(autoBill ? "Card saved. Auto-bill is on for every 28 days." : "Auto-bill is off for this ledger.");
    router.refresh();
  }

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send(true, event.currentTarget);
      }}
    >
      <p className="font-bold text-kv-navy sm:col-span-2">Card on file {autopay ? "(auto-bill on)" : "(auto-bill off)"}</p>
      <label className="text-xs font-semibold text-kv-navy">
        Card number
        <input name="cardNumber" inputMode="numeric" autoComplete="off" className="input mt-1" />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Expiry (MM/YY)
        <input name="expiry" autoComplete="off" placeholder="MM/YY" className="input mt-1" />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Security code
        <input name="cvv" inputMode="numeric" autoComplete="off" className="input mt-1" />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Name on card
        <input name="billingName" className="input mt-1" />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Billing street
        <input name="billingStreet" className="input mt-1" />
      </label>
      <label className="text-xs font-semibold text-kv-navy">
        Billing postal code
        <input name="billingPostal" className="input mt-1" />
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className="btn-navy btn-sm" disabled={pending}>
          Save card for 28-day auto-bill
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={pending}
          onClick={() => void send(false)}
        >
          Turn auto-bill off
        </button>
      </div>
      {error && <p className="text-sm text-kv-red sm:col-span-2">{error}</p>}
      {notice && <p className="text-sm font-semibold text-kv-navy sm:col-span-2">{notice}</p>}
    </form>
  );
}
