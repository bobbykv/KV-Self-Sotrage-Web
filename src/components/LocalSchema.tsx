import { BRAND, LOCATIONS, type Location } from "@/config/locations";

function storageSchema(l: Location, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SelfStorage",
    name: l.name,
    url: `${siteUrl}/locations#${l.key}`,
    telephone: BRAND.phoneE164,
    email: BRAND.email,
    image: `${siteUrl}/photos/hero.jpg`,
    address: { "@type": "PostalAddress", streetAddress: l.street, addressLocality: l.city, addressRegion: l.region, addressCountry: l.country },
    areaServed: l.serves.map((s) => ({ "@type": "City", name: s })),
    openingHoursSpecification: l.officeHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: h.open,
      closes: h.close,
    })),
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "24/7 access", value: true },
      ...(l.amenities.climateControlled ? [{ "@type": "LocationFeatureSpecification", name: "Climate-controlled units", value: true }] : []),
      ...(l.amenities.vehicleParking ? [{ "@type": "LocationFeatureSpecification", name: "RV, boat and vehicle parking", value: true }] : []),
      ...(l.amenities.nokeRemoteUnlock ? [{ "@type": "LocationFeatureSpecification", name: "Noke smart-lock remote unlock", value: true }] : []),
    ],
  };
}

export function LocalSchema({ only }: { only?: Location["key"][] }) {
  const siteUrl = process.env.APP_URL ?? "https://kvselfstorage.ca";
  const data = LOCATIONS.filter((l) => !only || only.includes(l.key)).map((l) => storageSchema(l, siteUrl));
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
