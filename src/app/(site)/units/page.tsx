import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { PromoBanner } from "@/components/PromoBanner";
import { UnitGroupCard } from "@/components/UnitCards";
import { LOCATIONS, getLocation, isLocationKey } from "@/config/locations";
import { filterGroups, formatSize, fullTypes, groupUnits, SIZE_LABELS, type SizeCategory } from "@/lib/catalog";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Available Storage Units & Prices",
  description: "Live storage unit availability and monthly prices at KV Self Storage in Antigonish, Addington Forks and Stellarton, NS.",
};

const CATS = Object.keys(SIZE_LABELS) as SizeCategory[];

function updatedLabel(iso: string | null) {
  if (!iso) return "not yet loaded";
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const at = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Halifax" });
  return mins < 1 ? `just now (${at})` : `${mins} min ago (${at})`;
}

export default async function UnitsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const category = CATS.includes(sp.size as SizeCategory) ? (sp.size as SizeCategory) : undefined;
  const climate = sp.climate === "1";
  const notice = sp.notice;

  const [inventory, promos] = await Promise.all([getInventory(), getLivePromotions({ placement: "units", location })]);
  const groups = groupUnits(inventory.flatMap((l) => l.units));
  const shown = filterGroups(groups, { location, category, climate: climate || undefined, vehicle: category === "parking" ? true : undefined });
  const full = fullTypes(
    inventory.flatMap((l) => l.priceList),
    groups,
  ).filter((p) => (!location || p.locationKey === location) && (!climate || p.climate));
  const oldest = inventory
    .filter((l) => !location || l.location === location)
    .map((l) => l.refreshedAt)
    .sort()[0] ?? null;
  const anyError = inventory.some((l) => l.lastError && (!location || l.location === location));

  return (
    <div className="container-kv py-8 sm:py-12">
      <p className="eyebrow">Units & prices</p>
      <h1 className="h1 mt-2">{location ? `Available at ${getLocation(location).shortName}` : "What's open right now"}</h1>
      <p className="mt-3 text-sm text-kv-muted">
        Live from our booking system · updated {updatedLabel(oldest)}. Prices are per month; HST is added and shown at checkout.
        {anyError && " Some data may be a little behind — call us to confirm."}
      </p>

      {notice && <p className="mt-4 rounded-xl bg-kv-red-50 p-4 font-semibold text-kv-red" role="alert">{notice}</p>}

      <form method="get" className="mt-6 grid gap-3 rounded-2xl border border-kv-line p-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Location</span>
          <select name="location" defaultValue={location ?? ""} className="input">
            <option value="">All locations</option>
            {LOCATIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.shortName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Size</span>
          <select name="size" defaultValue={category ?? ""} className="input">
            <option value="">Any size</option>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {SIZE_LABELS[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 self-end rounded-xl border border-kv-line px-4 py-3">
          <input type="checkbox" name="climate" value="1" defaultChecked={climate} className="h-5 w-5 accent-kv-red" />
          <span className="text-sm font-semibold text-kv-navy">Climate-controlled only</span>
        </label>
        <button className="btn-navy self-end">Show units</button>
      </form>

      <div className="mt-6">
        <PromoBanner promos={promos} compact />
      </div>

      {shown.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <UnitGroupCard key={g.key} g={g} />
          ))}
        </div>
      ) : (
        <div className="card mt-8 p-6">
          <h2 className="text-xl font-extrabold text-kv-navy">Nothing matching is open right now</h2>
          <p className="mt-1 text-kv-muted">Leave your details and we&apos;ll contact you as soon as one opens up. No charge to be on the list.</p>
          <div className="mt-4 max-w-xl">
            <LeadForm reason="unavailable_unit" locationKey={location} unitType={category ? SIZE_LABELS[category].label : undefined} />
          </div>
        </div>
      )}

      {full.length > 0 && (
        <section className="mt-12">
          <h2 className="h2 text-xl sm:text-2xl">Currently full</h2>
          <p className="mt-1 text-sm text-kv-muted">These sizes are all rented. Join the list and we&apos;ll call you when one frees up.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {full.slice(0, 8).map((p) => (
              <details key={`${p.locationKey}-${p.unitTypeId}`} className="card p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block font-extrabold text-kv-navy">
                      {formatSize(p.widthFt, p.lengthFt)} {p.typeName}
                    </span>
                    <span className="text-sm text-kv-muted">{getLocation(p.locationKey).shortName}</span>
                  </span>
                  <span className="btn-ghost btn-sm">Join waitlist</span>
                </summary>
                <div className="mt-4">
                  <LeadForm reason="waitlist" locationKey={p.locationKey} unitType={p.typeName} unitSize={`${p.widthFt}x${p.lengthFt}`} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-kv-muted">
        Not sure which size? <Link href="/size-finder" className="font-semibold text-kv-red underline">Try the size finder</Link>.
      </p>
    </div>
  );
}
