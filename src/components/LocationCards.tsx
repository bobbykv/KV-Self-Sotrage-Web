import Image from "next/image";
import Link from "next/link";
import { LOCATIONS, formatOfficeHours, fullAddress, type Location } from "@/config/locations";
import { staticFacilityCoverUrl } from "@/lib/photos";

const UNIT_BUTTON: Record<string, string> = {
  haley: "See Haley Road units",
  hwy4: "See Addington Forks units",
  stellarton: "See Stellarton units",
};

export function AmenityList({ l, showStorageTypes = true }: { l: Location; showStorageTypes?: boolean }) {
  const a = l.amenities;
  const items = [
    showStorageTypes && a.climateControlled === true && "Climate-controlled units",
    showStorageTypes && a.vehicleParking === true && "RV, boat and vehicle parking",
    a.nokeRemoteUnlock && "Nokē app unlock",
    a.gatedAccess && "Gated coded entry",
    a.surveillance && "Camera surveillance",
    `${l.access} access`,
  ].filter(Boolean) as string[];
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kv-red" aria-hidden />
          {i}
        </li>
      ))}
    </ul>
  );
}

export function LocationCards({ counts }: { counts?: Record<string, number> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {LOCATIONS.map((l) => (
        <article key={l.key} id={l.key} className="card flex flex-col gap-4 overflow-hidden p-6">
          <div className="relative -mx-6 -mt-6 mb-2 aspect-[16/10] overflow-hidden">
            <Image
              src={staticFacilityCoverUrl(l.key)}
              alt={`${l.shortName} facility`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-kv-navy">{l.cardTitle}</h2>
            <p className="text-sm text-kv-muted">{fullAddress(l)}</p>
            {l.landmark && <p className="text-sm text-kv-muted">{l.landmark}</p>}
          </div>
          <p className="text-sm">{l.blurb}</p>
          <AmenityList l={l} />
          <p className="text-xs text-kv-muted">Office hours: {formatOfficeHours(l)}</p>
          {counts && <p className="text-sm text-kv-muted">{counts[l.key] ?? 0} units open</p>}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Link href={`/locations/${l.key}`} className="btn-primary btn-sm min-h-11">
              Location details
            </Link>
            <Link href={`/units?location=${l.key}`} className="btn-ghost btn-sm min-h-11">
              {UNIT_BUTTON[l.key] ?? "See units"}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
