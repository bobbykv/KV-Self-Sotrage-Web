import Image from "next/image";
import Link from "next/link";
import { getLocation } from "@/config/locations";
import { formatSize, money, type UnitGroup } from "@/lib/catalog";

export function FeatureTags({ g }: { g: Pick<UnitGroup, "climate" | "inside" | "power" | "vehicle"> }) {
  const tags = [g.climate && "Climate-controlled", g.vehicle && "Vehicle, RV & boat parking", !g.vehicle && g.inside && !g.climate && "Indoor", !g.vehicle && !g.inside && "Drive-up", g.power && "Power"].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="badge bg-kv-navy-50 text-kv-navy">
          {t}
        </span>
      ))}
    </div>
  );
}

export function UnitGroupCard({ g, imageUrl }: { g: UnitGroup; imageUrl?: string }) {
  const loc = getLocation(g.locationKey);
  const area = Math.round(g.widthFt * g.lengthFt);
  const titleNoun = g.vehicle ? "parking space" : "storage unit";
  return (
    <article className="card flex flex-col gap-4 p-5">
      {imageUrl && (
        <div className="overflow-hidden rounded-2xl">
          <Image
            src={imageUrl}
            alt={`${formatSize(g.widthFt, g.lengthFt)} ${titleNoun} at ${loc.shortName}`}
            width={640}
            height={400}
            unoptimized={imageUrl.startsWith("/")}
            className="aspect-[16/10] w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-kv-navy">
            {formatSize(g.widthFt, g.lengthFt)} {titleNoun}
          </h3>
          <p className="mt-0.5 text-sm text-kv-muted">{loc.shortName}</p>
          <p className="text-sm text-kv-muted">
            {g.typeName} · {area} sq. ft. approximately
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-kv-red">{money(g.fromRate)}</p>
          <p className="text-xs text-kv-muted">/month + HST</p>
        </div>
      </div>
      <FeatureTags g={g} />
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-kv-navy">{g.available} available</p>
        <Link href={`/units/${g.locationKey}/${g.bestUnitId}`} className="btn-primary btn-sm min-h-11">
          View unit
        </Link>
      </div>
    </article>
  );
}
