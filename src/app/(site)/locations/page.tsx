import type { Metadata } from "next";
import { LocalSchema } from "@/components/LocalSchema";
import { LocationCards } from "@/components/LocationCards";
import { getInventory } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Storage Locations in Antigonish & Stellarton",
  description: "Three KV Self Storage locations: 20 Haley Road Antigonish, 2784 NS-4 Addington Forks (Exit 31), and 30 Heritage Avenue Stellarton. 24/7 access.",
};

export default async function LocationsPage() {
  const inventory = await getInventory();
  const counts = Object.fromEntries(inventory.map((l) => [l.location, l.units.length]));
  return (
    <div className="container-kv py-10 sm:py-16">
      <LocalSchema />
      <p className="eyebrow">Locations</p>
      <h1 className="h1 mt-2">Find storage that fits your day</h1>
      <p className="mt-3 max-w-2xl text-kv-muted">
        Keep your belongings close to home, work, or your next move. Compare three convenient locations, each with 24/7 access. For climate-controlled storage or vehicle parking, start with Haley Road.
      </p>
      <div className="mt-8">
        <LocationCards counts={counts} />
      </div>
    </div>
  );
}
