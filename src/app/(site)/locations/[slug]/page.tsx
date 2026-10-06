import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AmenityList } from "@/components/LocationCards";
import { BRAND, formatOfficeHours, fullAddress, getLocation, isLocationKey, LOCATIONS } from "@/config/locations";
import { getInventory } from "@/lib/inventory";
import { listLocationPhotos } from "@/lib/photos";
import { allowSearchIndexing } from "@/lib/site-env";

type Params = { slug: string };

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ slug: l.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isLocationKey(slug)) return { title: "Location" };
  const loc = getLocation(slug);
  return {
    title: `${loc.cardTitle} | KV Self Storage`,
    description: `${loc.blurb} ${fullAddress(loc)}. ${loc.access} access.`,
    robots: allowSearchIndexing() ? undefined : { index: false, follow: false },
  };
}

export default async function LocationDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  if (!isLocationKey(slug)) notFound();
  const loc = getLocation(slug);
  const [photos, inventory] = await Promise.all([listLocationPhotos(slug), getInventory()]);
  const unitCount = inventory.find((l) => l.location === slug)?.units.length ?? 0;
  const address = fullAddress(loc);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const gallery = photos.length
    ? photos
    : [{ id: "stock", url: "/photos/hero.jpg", altText: `Storage at ${loc.shortName}`, caption: null as string | null, isCover: true }];

  return (
    <div className="container-kv py-10 sm:py-16">
      <p className="eyebrow">Locations</p>
      <h1 className="h1 mt-2">{loc.cardTitle}</h1>
      <p className="mt-3 max-w-2xl text-kv-muted">{loc.blurb}</p>
      <p className="mt-2 text-sm text-kv-muted">
        {address}
        {loc.landmark ? ` · ${loc.landmark}` : ""}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-3xl">
            <Image
              src={p.url}
              alt={p.altText || `Storage at ${loc.shortName}`}
              width={900}
              height={600}
              className="aspect-[4/3] w-full object-cover"
            />
            {p.caption && <figcaption className="mt-2 text-sm text-kv-muted">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="h2 text-xl sm:text-2xl">Hours &amp; access</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-kv-navy">Office hours</dt>
              <dd className="text-kv-muted">{formatOfficeHours(loc)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-kv-navy">Facility access</dt>
              <dd className="text-kv-muted">{loc.access}</dd>
            </div>
            <div>
              <dt className="font-semibold text-kv-navy">Phone</dt>
              <dd>
                <a href={`tel:${BRAND.phoneE164}`} className="font-semibold text-kv-red">
                  {BRAND.phone}
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <h3 className="font-extrabold text-kv-navy">Amenities</h3>
            <div className="mt-3">
              <AmenityList l={loc} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/units?location=${loc.key}`} className="btn-primary">
              See units &amp; prices{unitCount ? ` (${unitCount} open)` : ""}
            </Link>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Get directions
            </a>
          </div>
        </section>

        <section>
          <h2 className="h2 text-xl sm:text-2xl">Map</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-kv-line bg-kv-navy-50">
            <iframe
              title={`Map of ${loc.shortName}`}
              src={mapSrc}
              className="aspect-[4/3] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
      </div>
    </div>
  );
}
