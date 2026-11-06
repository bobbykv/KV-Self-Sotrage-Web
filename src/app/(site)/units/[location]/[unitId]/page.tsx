import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AmenityList } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { FeatureTags } from "@/components/UnitCards";
import { BRAND, fullAddress, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, isWinterStoragePackage, money, publicMonthlyRate, storageTypeLabel } from "@/lib/catalog";
import { getPublicDiscountPlans } from "@/lib/discount-catalog";
import { offerForUnit, rateSuffix } from "@/lib/sitelink/concessions";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";
import { unitTypePhotoUrl } from "@/lib/photos";
import { allowSearchIndexing } from "@/lib/site-env";
import { getSettings } from "@/lib/settings";
import { moveInWindow } from "@/lib/move-in-date";
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
  const monthly = unit ? publicMonthlyRate(unit) : 0;
  return {
    title: `${sizeLabel} ${noun} at ${loc.shortName}`,
    description: unit
      ? `${sizeLabel} ${noun} at ${loc.shortName} from ${money(monthly)}${isWinterStoragePackage(unit.typeName) ? " 6-month winter storage package" : " per month"} + HST. ${fullAddress(loc)}. Gated access and ${loc.access} entry.`
      : `Storage at ${loc.shortName}.`,
    robots: allowSearchIndexing() ? undefined : { index: false, follow: false },
  };
}

export default async function UnitDetail({ params }: { params: Promise<Params> }) {
  const { location, unitId } = await params;
  if (!isLocationKey(location)) redirect("/units");
  const [inventory, settings, promos, discountPlans] = await Promise.all([
    getInventory(),
    getSettings(),
    getLivePromotions({ placement: "units", location }),
    getPublicDiscountPlans(),
  ]);
  const unit = inventory.find((l) => l.location === location)?.units.find((u) => u.unitId === Number(unitId));
  if (!unit) redirect(`/units?location=${location}&notice=${encodeURIComponent("This unit is no longer available. Check the other units at this location.")}`);
  const loc = getLocation(location);
  const sizeLabel = formatSize(unit.widthFt, unit.lengthFt);
  const monthly = publicMonthlyRate(unit);
  const offer = offerForUnit(discountPlans[location] ?? [], unit);
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
  const dates = moveInWindow();

  return (
    <div className="container-kv py-8 sm:py-12">
      <Link href={`/units?location=${location}`} className="text-sm font-semibold text-kv-navy hover:text-kv-red">
        ← See available units
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="overflow-hidden rounded-3xl bg-kv-navy-50">
            <Image src={photoUrl} alt={`${sizeLabel} ${noun} at ${loc.shortName}`} width={929} height={622} priority sizes="(max-width: 1024px) 100vw, 66vw" className="aspect-[16/9] w-full object-cover" />
          </div>
          <h1 className="h1 mt-6">
            {`${sizeLabel} ${noun} at ${loc.shortName}`}
          </h1>
          <p className="mt-2 text-2xl font-extrabold text-kv-red">
            {money(monthly)}
            <span className="text-base font-semibold text-kv-muted"> {rateSuffix(unit.typeName)}</span>
          </p>
          {offer && <p className="mt-1 font-bold text-kv-red">{offer}</p>}
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
                <dd className="font-semibold">{storageTypeLabel(unit)}</dd>
              </div>
              <div>
                <dt className="text-kv-muted">Location</dt>
                <dd className="font-semibold">{loc.shortName}</dd>
              </div>
              <div>
                <dt className="text-kv-muted">{isWinterStoragePackage(unit.typeName) ? "Winter storage package" : "Monthly rent"}</dt>
                <dd className="font-semibold">
                  {money(monthly)} {rateSuffix(unit.typeName)}
                </dd>
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
              <HoldForm location={location} unitId={unit.unitId} holdMinutes={settings.holdMinutes} minDate={dates.min} maxDate={dates.max} />
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
