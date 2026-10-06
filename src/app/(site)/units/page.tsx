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
  title: "Available Storage Units & Prices",
  description: "Compare storage sizes and monthly prices in Antigonish, Addington Forks, and Stellarton. Find a space for your belongings and get help choosing the right fit.",
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
  const range = category ? {} : areaRangeFromParams(sp);
  const filter: UnitFilter = { location, category, climate: climate || undefined, vehicle: category === "parking" ? true : false, ...range };
  const notice = sp.notice;

  const [inventory, promos] = await Promise.all([getInventory(), getLivePromotions({ placement: "units", location })]);
  const groups = groupUnits(inventory.flatMap((l) => l.units));
  // Without a storage-size preference, include vehicle spaces in browsing too.
  if (!category && !range.minArea && !range.maxArea) filter.vehicle = undefined;
  const shown = filterGroups(groups, filter);
  const full = filterFullTypes(fullTypes(
    inventory.flatMap((l) => l.priceList),
    groups,
  ), filter);
  const oldest = inventory
    .filter((l) => !location || l.location === location)
    .map((l) => l.refreshedAt)
    .sort()[0] ?? null;
  const anyError = inventory.some((l) => l.lastError && (!location || l.location === location));

  return (
    <div className="container-kv py-8 sm:py-12">
      <p className="eyebrow">Units & prices</p>
      <h1 className="h1 mt-2">{location ? `Find your space at ${getLocation(location).shortName}` : "Find a space that fits your life"}</h1>
      <p className="mt-3 max-w-2xl text-kv-muted">Compare sizes and monthly rent for the belongings you&apos;re keeping. Need help with the fit? <Link href="/size-finder" className="font-semibold text-kv-red underline">Start with the size guide</Link>.</p>
      <p className="mt-3 text-sm text-kv-muted">
        Listings updated {updatedLabel(oldest)}. Monthly rent is shown before HST. Review your full move-in total at checkout.
        {anyError && " We couldn't update some listings. Please call to confirm your options."}
      </p>

      {notice && <p className="mt-4 rounded-xl bg-kv-red-50 p-4 font-semibold text-kv-red" role="alert">{notice}</p>}

      <form method="get" className="mt-6 grid gap-3 rounded-2xl border border-kv-line p-4 sm:grid-cols-4">
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
          <span className="label">Size</span>
          <select name="size" defaultValue={category ?? ""} className="input">
            <option value="">{range.minArea && range.maxArea ? `Suggested range: ${range.minArea}–${range.maxArea} sq ft` : "Any size"}</option>
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
      {(category || location || climate || range.minArea || range.maxArea) && <Link href="/units" className="mt-3 inline-block text-sm font-semibold text-kv-red underline">Clear filters and compare all spaces</Link>}

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
          <h2 className="text-xl font-extrabold text-kv-navy">Let&apos;s find another option for you</h2>
          <p className="mt-1 text-kv-muted">No spaces match these filters at the moment. Try another size or location, or leave your details and we&apos;ll contact you when a suitable space opens. Joining the waitlist is free.</p>
          <div className="mt-4 max-w-xl">
            <LeadForm reason="unavailable_unit" locationKey={location} unitType={category ? SIZE_LABELS[category].label : undefined} unitSize={range.minArea && range.maxArea ? `${range.minArea}–${range.maxArea} sq ft` : undefined} />
          </div>
        </div>
      )}

      {full.length > 0 && (
        <section className="mt-12">
          <h2 className="h2 text-xl sm:text-2xl">Currently full</h2>
          <p className="mt-1 text-sm text-kv-muted">Prefer one of these sizes? Join the free waitlist and we&apos;ll contact you when a space opens.</p>
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
