import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AmenityList } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { FeatureTags } from "@/components/UnitCards";
import { fullAddress, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, money, sizeCategory, SIZE_LABELS } from "@/lib/catalog";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";
import { getSettings } from "@/lib/settings";
import { HoldForm } from "./HoldForm";

type Params = { location: string; unitId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { location } = await params;
  return { title: isLocationKey(location) ? `Storage unit at ${getLocation(location).shortName}` : "Storage unit", robots: { index: false } };
}

function isoDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(d);
}

export default async function UnitDetail({ params }: { params: Promise<Params> }) {
  const { location, unitId } = await params;
  if (!isLocationKey(location)) redirect("/units");
  const [inventory, settings, promos] = await Promise.all([getInventory(), getSettings(), getLivePromotions({ placement: "units", location })]);
  const unit = inventory.find((l) => l.location === location)?.units.find((u) => u.unitId === Number(unitId));
  if (!unit) redirect(`/units?location=${location}&notice=${encodeURIComponent("Sorry — that unit was just taken. Here's what's still open.")}`);
  const loc = getLocation(location);
  const cat = sizeCategory(unit);

  return (
    <div className="container-kv py-8 sm:py-12">
      <Link href={`/units?location=${location}`} className="text-sm font-semibold text-kv-navy hover:text-kv-red">
        ← All units at {loc.shortName}
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="overflow-hidden rounded-3xl">
            <Image src={unit.inside ? "/photos/facility-2.jpg" : "/photos/hero.jpg"} alt={`Storage units at ${loc.shortName}`} width={929} height={622} className="aspect-[16/9] w-full object-cover" />
          </div>
          <p className="mt-2 text-xs text-kv-muted">Photo of our facility. Your unit may vary slightly.</p>
          <p className="eyebrow mt-6">{SIZE_LABELS[cat].label} · {loc.shortName}</p>
          <h1 className="h1 mt-2">
            {formatSize(unit.widthFt, unit.lengthFt)} {unit.typeName}
          </h1>
          <p className="mt-2 text-kv-muted">
            About {unit.areaSqFt} sq ft — {SIZE_LABELS[cat].hint.split("·")[1]?.trim()}.
          </p>
          <div className="mt-4">
            <FeatureTags g={unit} />
          </div>
          {unit.description && <p className="mt-4">{unit.description}</p>}

          <div className="card mt-8 p-6">
            <h2 className="font-extrabold text-kv-navy">{loc.name}</h2>
            <p className="text-sm text-kv-muted">{fullAddress(loc)}</p>
            <div className="mt-4">
              <AmenityList l={loc} />
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6">
            <p className="text-sm text-kv-muted">Monthly rent</p>
            <p className="text-4xl font-extrabold text-kv-red">{money(unit.rate)}</p>
            {unit.standardRate > unit.rate && <p className="text-sm text-kv-muted line-through">{money(unit.standardRate)} standard rate</p>}
            <p className="mt-1 text-xs text-kv-muted">+ HST. Any admin fee or deposit is listed on the next screen before you pay.</p>
            <div className="mt-4">
              <PromoBanner promos={promos} compact />
            </div>
            <div className="mt-6">
              <HoldForm location={location} unitId={unit.unitId} holdMinutes={settings.holdMinutes} minDate={isoDate(new Date())} maxDate={isoDate(new Date(Date.now() + 30 * 86_400_000))} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
