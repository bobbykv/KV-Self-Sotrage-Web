"use client";

import { useMemo, useState } from "react";
import type { LocationKey } from "@/config/locations";
import { getLocation } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { CA_PROVINCES, US_STATES } from "@/lib/regions";
import { isWinterPrepaidPlan, publicPlansForUnit } from "@/lib/sitelink/concessions";
import type { ConcessionPlan } from "@/lib/sitelink/types";

export type BookUnit = {
  locationKey: LocationKey;
  unitId: number;
  unitName: string;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  rate: number;
  unitTypeId: number;
};

type Result =
  | { mode: "hold"; checkoutUrl: string; expiresAt: string }
  | { mode: "movein"; leaseUrl: string | null; receiptRef: string | null; total: number; autoBillEnabled: boolean; tenantId: number };

export function StaffBooking({
  units,
  plans,
  toggles,
  initialLocation,
  initialUnitId,
}: {
  units: BookUnit[];
  plans: (ConcessionPlan & { locationKey: LocationKey })[];
  toggles: Record<string, boolean>;
  initialLocation?: LocationKey;
  initialUnitId?: number;
}) {
  const [location, setLocation] = useState<LocationKey | "">(initialLocation ?? "");
  const [unitId, setUnitId] = useState(initialUnitId ? String(initialUnitId) : "");
  const [payMethod, setPayMethod] = useState<"card" | "cash" | "check">("card");
  const [pending, setPending] = useState<"hold" | "movein" | null>(null);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Result>();
  const [copied, setCopied] = useState(false);

  const siteUnits = units.filter((u) => u.locationKey === location);
  const unit = siteUnits.find((u) => String(u.unitId) === unitId);
  const sitePlans = useMemo(() => {
    if (!unit) return [];
    return publicPlansForUnit(
      plans.filter((p) => p.locationKey === unit.locationKey),
      unit,
      unit.locationKey,
      toggles,
    );
  }, [plans, toggles, unit]);
  const winterId = sitePlans.find((p) => isWinterPrepaidPlan(p))?.concessionId;

  async function submit(mode: "hold" | "movein", form: HTMLFormElement) {
    setPending(mode);
    setError(undefined);
    setResult(undefined);
    setCopied(false);
    const data = new FormData(form);
    const card = {
      number: String(data.get("cardNumber") ?? ""),
      cvv: String(data.get("cvv") ?? ""),
      expiry: String(data.get("expiry") ?? ""),
      name: String(data.get("billingName") ?? ""),
      street: String(data.get("billingStreet") ?? ""),
      postal: String(data.get("billingPostal") ?? ""),
    };
    const concessionRaw = String(data.get("concessionId") ?? "");
    const body = {
      mode,
      locationKey: location,
      unitId: Number(unitId),
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      moveInDate: String(data.get("moveInDate") ?? ""),
      concessionId: concessionRaw ? Number(concessionRaw) : null,
      licenseNumber: String(data.get("licenseNumber") ?? ""),
      licenseRegion: String(data.get("licenseRegion") ?? ""),
      addr1: String(data.get("addr1") ?? ""),
      city: String(data.get("city") ?? ""),
      region: String(data.get("region") ?? "NS"),
      postalCode: String(data.get("postalCode") ?? ""),
      payMethod,
      checkNumber: String(data.get("checkNumber") ?? ""),
      saveCard: data.get("saveCard") === "on",
      card: payMethod === "card" ? card : undefined,
    };
    const res = await fetch("/api/admin/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const payload = await res?.json().catch(() => null);
    setPending(null);
    if (!res?.ok) {
      setError(payload?.error ?? "The booking did not complete.");
      return;
    }
    if (payload.mode === "hold") setResult({ mode: "hold", checkoutUrl: payload.checkoutUrl, expiresAt: payload.expiresAt });
    else setResult({ mode: "movein", leaseUrl: payload.leaseUrl, receiptRef: payload.receiptRef, total: payload.total, autoBillEnabled: payload.autoBillEnabled, tenantId: payload.tenantId });
  }

  return (
    <section id="book" className="card mb-8 scroll-mt-6 p-5">
      <h2 className="font-extrabold text-kv-navy">Book / reserve a unit</h2>
      <p className="mt-1 max-w-3xl text-sm text-kv-muted">
        Send the customer a checkout link so they can scan their ID, pay, and sign on their phone, or complete the move-in here. Card numbers are sent to SiteLink and are not stored on this website.
      </p>
      {!units.length && <p className="mt-3 text-sm text-kv-red">No vacant units are in the cache yet. Refresh units from SiteLink first.</p>}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label className="text-sm font-semibold text-kv-navy">
          Site
          <select
            className="input mt-1"
            value={location}
            onChange={(event) => {
              setLocation(event.target.value as LocationKey);
              setUnitId("");
            }}
            required
          >
            <option value="">Choose a site</option>
            {(["hwy4", "stellarton", "haley"] as LocationKey[]).map((key) => (
              <option key={key} value={key}>
                {key === "hwy4" ? "Exit 31" : getLocation(key).shortName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Vacant unit
          <select className="input mt-1" value={unitId} onChange={(event) => setUnitId(event.target.value)} required>
            <option value="">Choose a unit</option>
            {siteUnits.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.unitName} · {formatSize(u.widthFt, u.lengthFt)} {u.typeName} · {money(u.rate)}/28 days
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          First name
          <input name="firstName" className="input mt-1" required />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Last name
          <input name="lastName" className="input mt-1" required />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Email
          <input name="email" type="email" className="input mt-1" required />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Phone
          <input name="phone" className="input mt-1" required />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Move-in date
          <input name="moveInDate" type="date" className="input mt-1" required />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Discount
          <select name="concessionId" key={`${unitId}:${winterId ?? "none"}`} className="input mt-1" defaultValue={winterId ? String(winterId) : ""}>
            <option value="">Standard 28-day billing</option>
            {sitePlans.map((plan) => (
              <option key={plan.concessionId} value={plan.concessionId}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2 mt-2 border-t border-kv-line pt-4">
          <p className="text-sm font-extrabold text-kv-navy">Complete staff move-in</p>
          <p className="text-xs text-kv-muted">Required only when you finish the move-in here. A checkout link leaves the licence and payment to the customer.</p>
        </div>
        <label className="text-sm font-semibold text-kv-navy">
          Driver&apos;s licence
          <input name="licenseNumber" className="input mt-1" />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Licence province
          <select name="licenseRegion" className="input mt-1" defaultValue="NS">
            {CA_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
            {US_STATES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-kv-navy sm:col-span-2">
          Street address
          <input name="addr1" className="input mt-1" />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          City
          <input name="city" className="input mt-1" />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Province
          <select name="region" className="input mt-1" defaultValue="NS">
            {CA_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Postal code
          <input name="postalCode" className="input mt-1" />
        </label>
        <label className="text-sm font-semibold text-kv-navy">
          Payment
          <select className="input mt-1" value={payMethod} onChange={(event) => setPayMethod(event.target.value as "card" | "cash" | "check")}>
            <option value="card">Credit card</option>
            <option value="cash">Cash</option>
            <option value="check">Check / e-transfer</option>
          </select>
        </label>
        {payMethod === "check" && (
          <label className="text-sm font-semibold text-kv-navy">
            Check or e-transfer reference
            <input name="checkNumber" className="input mt-1" />
          </label>
        )}
        {payMethod === "card" && (
          <>
            <label className="text-sm font-semibold text-kv-navy">
              Card number
              <input name="cardNumber" inputMode="numeric" autoComplete="off" className="input mt-1" />
            </label>
            <label className="text-sm font-semibold text-kv-navy">
              Expiry (MM/YY)
              <input name="expiry" autoComplete="off" className="input mt-1" placeholder="MM/YY" />
            </label>
            <label className="text-sm font-semibold text-kv-navy">
              Security code
              <input name="cvv" inputMode="numeric" autoComplete="off" className="input mt-1" />
            </label>
            <label className="text-sm font-semibold text-kv-navy">
              Name on card
              <input name="billingName" className="input mt-1" />
            </label>
            <label className="text-sm font-semibold text-kv-navy">
              Billing street
              <input name="billingStreet" className="input mt-1" />
            </label>
            <label className="text-sm font-semibold text-kv-navy">
              Billing postal code
              <input name="billingPostal" className="input mt-1" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="saveCard" defaultChecked />
              Save card for 28-day auto-bill
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            className="btn-navy btn-sm"
            disabled={pending !== null}
            onClick={(event) => {
              event.preventDefault();
              if (event.currentTarget.form) void submit("hold", event.currentTarget.form);
            }}
          >
            {pending === "hold" ? "Creating link…" : "Create hold & copy checkout link"}
          </button>
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={pending !== null}
            onClick={(event) => {
              event.preventDefault();
              if (event.currentTarget.form) void submit("movein", event.currentTarget.form);
            }}
          >
            {pending === "movein" ? "Moving in…" : "Complete staff move-in"}
          </button>
        </div>
      </form>
      {error && (
        <p className="mt-3 rounded-xl bg-kv-red-50 p-3 text-sm text-kv-red" role="alert">
          {error}
        </p>
      )}
      {result?.mode === "hold" && (
        <div className="mt-3 rounded-xl bg-kv-navy-50 p-3 text-sm">
          <p className="font-bold text-kv-navy">Checkout link (open on the customer&apos;s phone)</p>
          <p className="mt-1 break-all font-mono text-xs">{result.checkoutUrl}</p>
          <button
            type="button"
            className="btn-ghost btn-sm mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(result.checkoutUrl).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {result?.mode === "movein" && (
        <div className="mt-3 rounded-xl bg-kv-navy-50 p-3 text-sm">
          <p className="font-bold text-kv-navy">Move-in complete · {money(result.total)}</p>
          <p className="mt-1">Tenant #{result.tenantId}{result.receiptRef ? ` · receipt ${result.receiptRef}` : ""}{result.autoBillEnabled ? " · card saved for 28-day auto-bill" : ""}</p>
          {result.leaseUrl ? (
            <p className="mt-2 break-all">
              eSign lease:{" "}
              <a href={result.leaseUrl} className="font-semibold text-kv-red underline" target="_blank" rel="noopener noreferrer">
                {result.leaseUrl}
              </a>
              <button type="button" className="btn-ghost btn-sm ml-2" onClick={() => void navigator.clipboard.writeText(result.leaseUrl!)}>
                Copy
              </button>
            </p>
          ) : (
            <p className="mt-2 text-kv-muted">eSign lease URL was not returned for this site.</p>
          )}
        </div>
      )}
    </section>
  );
}
