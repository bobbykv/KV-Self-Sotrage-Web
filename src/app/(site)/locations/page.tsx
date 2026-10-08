import type { Metadata } from "next";
import Link from "next/link";
import { LocalSchema } from "@/components/LocalSchema";
import { LocationCards } from "@/components/LocationCards";
import { BRAND } from "@/config/locations";
import { getInventory } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Storage Locations in Antigonish and Stellarton",
  description: "Find KV Self Storage on Haley Road, at Exit 31 in Addington Forks, and on Heritage Avenue in Stellarton. All three offer 24/7 access.",
};

export default async function LocationsPage() {
  const inventory = await getInventory();
  const counts = Object.fromEntries(inventory.map((l) => [l.location, l.units.length]));
  return (
    <div className="container-kv py-10 sm:py-16">
      <LocalSchema />
      <h1 className="h1">Self storage locations in Antigonish and Stellarton</h1>
      <p className="mt-3 max-w-2xl text-kv-muted">Choose the location that works for you. All three have gated coded entry, cameras and 24/7 access.</p>
      <div className="mt-8">
        <LocationCards counts={counts} />
      </div>
      <section className="mt-14 rounded-3xl bg-kv-navy-50 p-6 sm:p-8">
        <h2 className="h2 text-xl sm:text-2xl">Not sure which location to choose?</h2>
        <p className="mt-2 text-kv-muted">
          Tell us where you are and what you&apos;re storing. Call{" "}
          <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
            {BRAND.phone}
          </a>
          .
        </p>
        <Link href="/contact" className="btn-primary mt-4">
          Contact us
        </Link>
      </section>
    </div>
  );
}
