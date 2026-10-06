import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { PromoBanner } from "@/components/PromoBanner";
import { UnitGroupCard } from "@/components/UnitCards";
import { LOCATIONS, getLocation, isLocationKey } from "@/config/locations";
import { areaRangeFromParams, filterFullTypes, filterGroups, formatSize, fullTypes, groupUnits, SIZE_LABELS, type SizeCategory, type UnitFilter } from "@/lib/catalog";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Storage Units & Prices in Antigonish and Stellarton",
  description: "Compare storage sizes and monthly prices at KV Self Storage. Choose your location and check the full total, including HST, at checkout.",
};

const CATS = Object.keys(SIZE_LABELS) as SizeCategory[];

function updatedLabel(iso: string | null) {
  if (!iso) return "not yet loaded";
  const d = new Date(iso);
  const at = d.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium", timeStyle: "short" });
  return at;
}

export default async function UnitsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const category = CATS.includes(sp.size as SizeCategory) ? (sp.size as SizeCategory) : undefined;
  const climate = sp.climate === "1";
  const storageType = sp.type === "parking" ? "parking" : sp.type === "storage" ? "storage" : undefined;
  const range = category || storageType === "parking" ? {} : areaRangeFromParams(sp);
  const filter: UnitFilter = {
    location,
    category: storageType === "parking" ? "parking" : category,
    climate: climate || undefined,
    vehicle: storageType === "parking" ? true : storageType === "storage" ? false : category === "parking" ? true : false,
    ...range,
  };
  const notice = sp.notice;

  const [inventory, promos] = await Promise.all([getInventory(), getLivePromotions({ placement: "units", location })]);
  const groups = groupUnits(inventory.flatMap((l) => l.units));
  if (!category && !storageType && !range.minArea && !range.maxArea) filter.vehicle = undefined;
  const shown = filterGroups(groups, filter);
  const full = filterFullTypes(
    fullTypes(
      inventory.flatMap((l) => l.priceList),
      groups,
    ),
    filter,
  );
  const oldest = inventory
    .filter((l) => !location || l.location === location)
    .map((l) => l.refreshedAt)
    .sort()[0] ?? null;
  const anyError = inventory.some((l) => l.lastError && (!location || l.location === location));

  return (
    <div className="container-kv py-8 sm:py-12">
      <h1 className="h1">{location ? `Storage units at ${getLocation(location).shortName}` : "Storage units and prices in Antigonish and Stellarton"}</h1>
      <p className="mt-3 max-w-2xl text-kv-muted">
        Pick your location. Compare sizes and monthly rent. Checkout shows fees and HST before you pay.{" "}
        <Link href="/size-finder" className="font-semibold text-kv-red underline">
          Not sure what size? Try the size finder.
        </Link>
      </p>
      <p className="mt-3 text-sm text-kv-muted">
        Prices and availability last updated: {updatedLabel(oldest)}. Availability can change. We check your unit again when you start checkout.
        {anyError && " We couldn't update some listings. Please call to confirm."}
      </p>

      {notice && (
        <p className="mt-4 rounded-xl bg-kv-red-50 p-4 font-semibold text-kv-red" role="alert">
          {notice}
        </p>
      )}

      <form method="get" className="mt-6 grid gap-3 rounded-2xl border border-kv-line p-4 sm:grid-cols-2 lg:grid-cols-5">
        {range.minArea && <input type="hidden" name="minArea" value={range.minArea} />}
        {range.maxArea && <input type="hidden" name="maxArea" value={range.maxArea} />}
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
          <span className="label">Unit size</span>
          <select name="size" defaultValue={category ?? ""} className="input">
            <option value="">{range.minArea && range.maxArea ? `Suggested range: ${range.minArea}–${range.maxArea} sq ft` : "All sizes"}</option>
            {CATS.filter((c) => c !== "parking").map((c) => (
              <option key={c} value={c}>
                {SIZE_LABELS[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Storage type</span>
          <select name="type" defaultValue={storageType ?? ""} className="input">
            <option value="">All storage types</option>
            <option value="storage">Storage units</option>
            <option value="parking">Vehicle, RV &amp; boat parking</option>
          </select>
        </label>
        <label className="flex items-center gap-3 self-end rounded-xl border border-kv-line px-4 py-3">
          <input type="checkbox" name="climate" value="1" defaultChecked={climate} className="h-5 w-5 accent-kv-red" />
          <span className="text-sm font-semibold text-kv-navy">Climate-controlled only</span>
        </label>
        <button className="btn-navy self-end">Show units</button>
      </form>
      {(category || location || climate || range.minArea || range.maxArea || storageType) && (
        <Link href="/units" className="mt-3 inline-block text-sm font-semibold text-kv-red underline">
          Clear filters
        </Link>
      )}

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
          <h2 className="text-xl font-extrabold text-kv-navy">No units match your choices</h2>
          <p className="mt-1 text-kv-muted">Try another size or location. Call (902) 867-3779 if you need help finding a fit.</p>
          <div className="mt-6">
            <h3 className="font-extrabold text-kv-navy">Want us to let you know?</h3>
            <p className="mt-1 text-sm text-kv-muted">Leave your details and the size you need. We&apos;ll contact you when a matching space opens. Joining the waitlist is free.</p>
            <div className="mt-4 max-w-xl">
              <LeadForm reason="unavailable_unit" locationKey={location} unitType={category ? SIZE_LABELS[category].label : undefined} unitSize={range.minArea && range.maxArea ? `${range.minArea}–${range.maxArea} sq ft` : undefined} />
            </div>
          </div>
        </div>
      )}

      {full.length > 0 && (
        <section className="mt-12">
          <h2 className="h2 text-xl sm:text-2xl">Want us to let you know?</h2>
          <p className="mt-1 text-sm text-kv-muted">Some sizes are currently full. Leave your details and we&apos;ll contact you when a matching space opens. Joining the waitlist is free.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {full.slice(0, 8).map((p) => (
              <details key={`${p.locationKey}-${p.unitTypeId}`} className="card p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block font-extrabold text-kv-navy">{formatSize(p.widthFt, p.lengthFt)} storage unit</span>
                    <span className="text-sm text-kv-muted">
                      {getLocation(p.locationKey).shortName} · No units available in this size.
                    </span>
                  </span>
                  <span className="btn-ghost btn-sm">Join the waitlist</span>
                </summary>
                <div className="mt-4">
                  <LeadForm reason="waitlist" locationKey={p.locationKey} unitType={p.typeName} unitSize={`${p.widthFt}x${p.lengthFt}`} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
