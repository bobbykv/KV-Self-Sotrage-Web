import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AmenityList } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { FeatureTags } from "@/components/UnitCards";
import { BRAND, fullAddress, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";
import { unitTypePhotoUrl } from "@/lib/photos";
import { allowSearchIndexing } from "@/lib/site-env";
import { getSettings } from "@/lib/settings";
import { HoldForm } from "./HoldForm";

type Params = { location: string; unitId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { location, unitId } = await params;
  if (!isLocationKey(location)) return { title: "Storage unit", robots: { index: false } };
  const inventory = await getInventory();
  const unit = inventory.find((l) => l.location === location)?.units.find((u) => u.unitId === Number(unitId));
  const loc = getLocation(location);
  const sizeLabel = unit ? formatSize(unit.widthFt, unit.lengthFt) : "Storage";
  const noun = unit?.vehicle ? "parking space" : "storage unit";
  return {
    title: `${sizeLabel} ${noun} at ${loc.shortName}`,
    description: unit
      ? `${sizeLabel} ${noun} at ${loc.shortName} from ${money(unit.rate)}/month + HST. ${fullAddress(loc)}. Gated access and ${loc.access} entry.`
      : `Storage at ${loc.shortName}.`,
    robots: allowSearchIndexing() ? undefined : { index: false, follow: false },
  };
}

function isoDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(d);
}

export default async function UnitDetail({ params }: { params: Promise<Params> }) {
  const { location, unitId } = await params;
  if (!isLocationKey(location)) redirect("/units");
  const [inventory, settings, promos] = await Promise.all([getInventory(), getSettings(), getLivePromotions({ placement: "units", location })]);
  const unit = inventory.find((l) => l.location === location)?.units.find((u) => u.unitId === Number(unitId));
  if (!unit) redirect(`/units?location=${location}&notice=${encodeURIComponent("This unit is no longer available. Check the other units at this location.")}`);
  const loc = getLocation(location);
  const sizeLabel = formatSize(unit.widthFt, unit.lengthFt);
  const photoUrl = await unitTypePhotoUrl({
    locationKey: location,
    typeName: unit.typeName,
    widthFt: unit.widthFt,
    lengthFt: unit.lengthFt,
    climate: unit.climate,
    inside: unit.inside,
    vehicle: unit.vehicle,
  });
  const noun = unit.vehicle ? "parking space" : "self storage";

  return (
    <div className="container-kv py-8 sm:py-12">
      <Link href={`/units?location=${location}`} className="text-sm font-semibold text-kv-navy hover:text-kv-red">
        ← See available units
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="overflow-hidden rounded-3xl">
            <Image src={photoUrl} alt={`${sizeLabel} ${noun} at ${loc.shortName}`} width={929} height={622} className="aspect-[16/9] w-full object-cover" />
          </div>
          <h1 className="h1 mt-6">
            {sizeLabel} {noun} at {loc.shortName}
          </h1>
          <p className="mt-2 text-2xl font-extrabold text-kv-red">
            {money(unit.rate)}
            <span className="text-base font-semibold text-kv-muted">/month + HST</span>
          </p>
          {unit.standardRate > unit.rate && <p className="text-sm text-kv-muted line-through">{money(unit.standardRate)} standard rate</p>}
          <p className="mt-3 text-kv-muted">
            Check the size and features below. Choose your move-in date to start checkout. We&apos;ll hold this unit for {settings.holdMinutes} minutes while you review the total.
          </p>
          <div className="mt-4">
            <FeatureTags g={unit} />
          </div>
          {unit.description && <p className="mt-4">{unit.description}</p>}

          <div className="card mt-8 p-6">
            <h2 className="font-extrabold text-kv-navy">Your unit</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-kv-muted">Size</dt>
                <dd className="font-semibold">{sizeLabel}</dd>
              </div>
              <div>
                <dt className="text-kv-muted">Approximate floor area</dt>
                <dd className="font-semibold">{unit.areaSqFt} sq. ft.</dd>
              </div>
              <div>
                <dt className="text-kv-muted">Storage type</dt>
                <dd className="font-semibold">{unit.typeName}</dd>
              </div>
              <div>
                <dt className="text-kv-muted">Location</dt>
                <dd className="font-semibold">{loc.shortName}</dd>
              </div>
              <div>
                <dt className="text-kv-muted">Monthly rent</dt>
                <dd className="font-semibold">{money(unit.rate)}/month + HST</dd>
              </div>
            </dl>
          </div>

          <div className="card mt-4 p-6">
            <h2 className="font-extrabold text-kv-navy">At this location</h2>
            <p className="mt-1 text-sm text-kv-muted">
              {loc.name} · {fullAddress(loc)}
            </p>
            <div className="mt-4">
              <AmenityList l={loc} showStorageTypes={false} />
              {unit.climate && (
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kv-red" aria-hidden />
                    Climate-controlled
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6">
            <h2 className="font-extrabold text-kv-navy">Choose your move-in date</h2>
            <div className="mt-4">
              <PromoBanner promos={promos} compact />
            </div>
            <div className="mt-4">
              <HoldForm location={location} unitId={unit.unitId} holdMinutes={settings.holdMinutes} minDate={isoDate(new Date())} maxDate={isoDate(new Date(Date.now() + 30 * 86_400_000))} />
            </div>
            <p className="mt-4 text-sm text-kv-muted">
              Unsure about the size? Call{" "}
              <a href={`tel:${BRAND.phoneE164}`} className="font-semibold text-kv-red">
                {BRAND.phone}
              </a>{" "}
              before you book.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
