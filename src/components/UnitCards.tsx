import Link from "next/link";
import { getLocation } from "@/config/locations";
import { formatSize, money, SIZE_LABELS, type UnitGroup } from "@/lib/catalog";

export function FeatureTags({ g }: { g: Pick<UnitGroup, "climate" | "inside" | "power" | "vehicle"> }) {
  const tags = [g.climate && "Climate-controlled", g.inside && !g.climate && "Indoor", !g.inside && !g.vehicle && "Drive-up", g.power && "Power", g.vehicle && "Vehicle / RV / Boat"].filter(Boolean) as string[];
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

export function UnitGroupCard({ g }: { g: UnitGroup }) {
  const loc = getLocation(g.locationKey);
  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-kv-muted">{SIZE_LABELS[g.category].label} · {loc.shortName}</p>
          <h3 className="mt-0.5 text-2xl font-extrabold text-kv-navy">{formatSize(g.widthFt, g.lengthFt)}</h3>
          <p className="text-sm text-kv-muted">{g.typeName} · ~{Math.round(g.widthFt * g.lengthFt)} sq ft</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-kv-red">{money(g.fromRate)}</p>
          <p className="text-xs text-kv-muted">per month + HST</p>
        </div>
      </div>
      <FeatureTags g={g} />
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-kv-navy">{g.available} available</p>
        <Link href={`/units/${g.locationKey}/${g.bestUnitId}`} className="btn-primary btn-sm min-h-11">
          Select
        </Link>
      </div>
    </article>
  );
}
