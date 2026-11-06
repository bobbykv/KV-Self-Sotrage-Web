import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SizeFinder } from "./SizeFinder";
import { getInventory } from "@/lib/inventory";
import { formatSize, groupUnits } from "@/lib/catalog";
import { getLocation } from "@/config/locations";

export const metadata: Metadata = {
  title: "Storage Size Finder for Antigonish and Stellarton",
  description: "Find a starting size for boxes, furniture, business stock or a household move. Compare available units in Antigonish and Stellarton.",
};

export default async function SizeFinderPage() {
  const inventory = await getInventory();
  const groups = groupUnits(inventory.filter((l) => l.availability === "live" || l.availability === "demo").flatMap((l) => l.units));
  const guide = [...new Map(groups.filter((g) => !g.vehicle).map((g) => [`${g.widthFt}x${g.lengthFt}`, g])).values()];
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <h1 className="h1">Find your storage size in Antigonish or Stellarton</h1>
        <p className="mt-3 text-kv-muted">Tell us what you&apos;re storing. We&apos;ll suggest sizes to compare. You can check the prices before you choose.</p>
        <div className="mt-6 overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="KV Self Storage drive-up units" width={940} height={361} className="w-full object-cover" />
        </div>
        <h2 className="mt-8 text-lg font-extrabold text-kv-navy">Sizes currently available</h2>
        <ul className="mt-4 space-y-2 text-sm text-kv-muted">
          {guide.map((g) => <li key={g.key}><Link href={`/units/${g.locationKey}/${g.bestUnitId}`} className="font-semibold text-kv-red underline">{formatSize(g.widthFt, g.lengthFt)}</Link>{` — ${getLocation(g.locationKey).shortName}`}</li>)}
        </ul>
        {!guide.length && <p className="mt-4 text-sm text-kv-muted">Call us to confirm the sizes currently available.</p>}
        <p className="mt-4 text-sm text-kv-muted">These are estimates. Measure large items and leave room to reach what you&apos;ll need.</p>
      </div>
      <div className="lg:pt-8">
        <SizeFinder groups={groups} />
      </div>
    </div>
  );
}
