import Link from "next/link";
import { LOCATIONS, formatHours, fullAddress, type Location } from "@/config/locations";

export function AmenityList({ l }: { l: Location }) {
  const a = l.amenities;
  const items = [
    `${l.access} access`,
    a.gatedAccess && "Gated, coded entry",
    a.surveillance && "Camera surveillance",
    a.climateControlled === true && "Climate-controlled units",
    a.vehicleParking === true && "RV, boat & vehicle parking",
    a.nokeRemoteUnlock && "Noke smart-lock remote unlock",
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
        <article key={l.key} id={l.key} className="card flex flex-col gap-4 p-6">
          <div>
            <h3 className="text-xl font-extrabold text-kv-navy">{l.shortName}</h3>
            <p className="text-sm text-kv-muted">{fullAddress(l)}</p>
            {l.landmark && <p className="text-sm text-kv-muted">{l.landmark}</p>}
          </div>
          <p className="text-sm">{l.blurb}</p>
          <AmenityList l={l} />
          <p className="text-xs text-kv-muted">
            Office {l.officeHours.map((h) => `${h.days} ${formatHours(h)}`).join(", ")}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Link href={`/units?location=${l.key}`} className="btn-primary btn-sm min-h-11">
              {counts ? `${counts[l.key] ?? 0} units open` : "See units"}
            </Link>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.street}, ${l.city}, ${l.region}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm min-h-11"
            >
              Directions
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
