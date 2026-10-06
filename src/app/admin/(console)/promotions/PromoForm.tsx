import type { Promotion } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { LOCATIONS } from "@/config/locations";
import { PLACEMENTS } from "@/lib/promotions";
import { savePromoAction } from "../actions";

const PLACEMENT_LABELS: Record<string, string> = { homepage: "Homepage", units: "Units pages", checkout: "Checkout" };

function toDateInput(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-CA", { timeZone: "America/Halifax" }) : "";
}

export function PromoForm({ promo }: { promo?: Promotion }) {
  const locs = promo?.locations ?? ["all"];
  const placements = promo?.placements ?? ["homepage"];
  return (
    <ActionForm action={savePromoAction.bind(null, promo?.id ?? null)} submitLabel={promo ? "Save promotion" : "Create promotion"} pendingLabel="Saving…" buttonClassName="btn-primary" className="card max-w-2xl space-y-4 p-5">
      <p className="rounded-xl bg-kv-yellow-light p-3 text-sm text-kv-navy">
        Promotions are <strong>display only</strong>. They do not change prices in SiteLink — set up any matching discount plan in SiteLink so checkout totals agree.
      </p>
      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" name="headline" required maxLength={120} defaultValue={promo?.headline} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="body">Details</label>
        <textarea id="body" name="body" rows={3} maxLength={400} defaultValue={promo?.body ?? ""} className="input py-2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="code">Promo code (optional)</label>
          <input id="code" name="code" maxLength={40} defaultValue={promo?.code ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="startsAt">Starts</label>
          <input id="startsAt" name="startsAt" type="date" defaultValue={toDateInput(promo?.startsAt)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">Ends</label>
          <input id="endsAt" name="endsAt" type="date" defaultValue={toDateInput(promo?.endsAt)} className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Locations</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="locations" value="all" defaultChecked={locs.includes("all")} className="h-5 w-5" /> All locations
          </label>
          {LOCATIONS.map((l) => (
            <label key={l.key} className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="locations" value={l.key} defaultChecked={locs.includes(l.key)} className="h-5 w-5" /> {l.shortName}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Show on</legend>
        <div className="flex flex-wrap gap-4">
          {PLACEMENTS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="placements" value={p} defaultChecked={placements.includes(p)} className="h-5 w-5" /> {PLACEMENT_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 font-semibold text-kv-navy">
          <input type="checkbox" name="active" defaultChecked={promo?.active ?? true} className="h-5 w-5" /> Active
        </label>
        <div>
          <label className="label" htmlFor="sortOrder">Sort order (lower shows first)</label>
          <input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={promo?.sortOrder ?? 0} className="input w-32" />
        </div>
      </div>
    </ActionForm>
  );
}
