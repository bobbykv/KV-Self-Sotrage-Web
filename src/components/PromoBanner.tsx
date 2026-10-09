import type { Promotion } from "@prisma/client";
import { getLocation, isLocationKey } from "@/config/locations";

function where(p: Promotion) {
  const locations = Array.isArray(p.locations) ? p.locations : [];
  if (locations.includes("all") || !locations.length) return "All locations";
  return locations.filter(isLocationKey).map((k) => getLocation(k).shortName).join(" · ");
}

export function PromoBanner({ promos, compact = false }: { promos: Promotion[]; compact?: boolean }) {
  if (!promos.length) return null;
  return (
    <div className="space-y-3">
      {promos.map((p) => (
        <aside key={p.id} className={`flex flex-col gap-2 rounded-2xl bg-kv-yellow text-kv-navy sm:flex-row sm:items-center sm:justify-between ${compact ? "px-4 py-3" : "px-5 py-4"}`} aria-label="Promotion">
          <div>
            <p className="font-extrabold">{p.headline}</p>
            {p.body && <p className="text-sm">{p.body}</p>}
            <p className="mt-0.5 text-xs font-semibold opacity-75">
              {where(p)}
              {p.endsAt && ` · Ends ${p.endsAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}
            </p>
          </div>
          {p.code && (
            <p className="shrink-0 text-sm">
              Mention code <span className="rounded-md bg-kv-navy px-2 py-1 font-mono font-bold text-kv-yellow">{p.code}</span>
            </p>
          )}
        </aside>
      ))}
    </div>
  );
}
