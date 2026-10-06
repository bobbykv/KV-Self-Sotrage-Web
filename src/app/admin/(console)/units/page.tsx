import { LocationSwitcher, PageHeader } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey, LOCATION_KEYS } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { db } from "@/lib/db";
import type { Unit } from "@/lib/sitelink/types";
import { refreshCacheAction } from "../actions";

export const metadata = { title: "Units" };

export default async function AdminUnits({ searchParams }: { searchParams: Promise<{ location?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const status = sp.status === "vacant" || sp.status === "occupied" ? sp.status : "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const locs = location ? [location] : [...LOCATION_KEYS];
  const snaps = await db.siteLinkSnapshot.findMany({ where: { locationKey: { in: locs }, kind: { in: ["all", "available"] } } });
  const holds = await db.hold.findMany({ where: { status: "active", expiresAt: { gt: new Date() } }, select: { locationKey: true, unitId: true, firstName: true, lastName: true, expiresAt: true } });

  const rows: (Unit & { source: string })[] = [];
  for (const loc of locs) {
    const all = snaps.find((s) => s.id === `${loc}:all`);
    const avail = snaps.find((s) => s.id === `${loc}:available`);
    const src = all && all.refreshedAt.getTime() > 0 ? all : avail;
    for (const u of (src?.data as Unit[]) ?? []) rows.push({ ...u, source: src === all ? "all" : "available" });
  }
  const filtered = rows
    .filter((u) => status === "all" || (status === "occupied" ? u.rented : !u.rented))
    .filter((u) => !q || u.unitName.toLowerCase().includes(q) || u.typeName.toLowerCase().includes(q) || `${u.widthFt}x${u.lengthFt}`.includes(q))
    .sort((a, b) => a.locationKey.localeCompare(b.locationKey) || a.unitName.localeCompare(b.unitName, undefined, { numeric: true }));
  const extra = [status !== "all" ? `status=${status}` : "", q ? `q=${encodeURIComponent(q)}` : ""].filter(Boolean).join("&");
  const asOf = snaps.filter((s) => s.kind === "all").map((s) => s.refreshedAt).sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <>
      <PageHeader title="Units">
        <form action={refreshCacheAction.bind(null, false)}>
          <button className="btn-navy btn-sm">Refresh from SiteLink</button>
        </form>
      </PageHeader>
      <LocationSwitcher current={location} basePath="/admin/units" extra={extra} />
      <form className="mt-4 flex flex-wrap gap-2" method="get">
        {location && <input type="hidden" name="location" value={location} />}
        <select name="status" defaultValue={status} className="input w-auto min-h-10">
          <option value="all">All units</option>
          <option value="vacant">Vacant</option>
          <option value="occupied">Occupied</option>
        </select>
        <input name="q" defaultValue={q} placeholder="Unit, type or 10x10" className="input w-56 min-h-10" />
        <button className="btn-ghost btn-sm min-h-10">Filter</button>
      </form>
      <p className="mt-3 text-xs text-kv-muted">
        {filtered.length} units · all-units snapshot {asOf && asOf.getTime() > 0 ? asOf.toLocaleString("en-CA", { timeZone: "America/Halifax" }) : "not loaded yet (showing vacant cache)"}
      </p>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-kv-navy-50 text-left text-xs text-kv-muted">
            <tr>
              <th className="p-3">Site</th>
              <th className="p-3">Unit</th>
              <th className="p-3">Size / type</th>
              <th className="p-3">Features</th>
              <th className="p-3 text-right">Std / web rate</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map((u) => {
              const hold = holds.find((h) => h.locationKey === u.locationKey && h.unitId === u.unitId);
              return (
                <tr key={`${u.locationKey}-${u.unitId}`} className="border-t border-kv-line">
                  <td className="p-3">{getLocation(u.locationKey).shortName}</td>
                  <td className="p-3 font-mono font-semibold">{u.unitName}</td>
                  <td className="p-3">
                    {formatSize(u.widthFt, u.lengthFt)} {u.typeName}
                  </td>
                  <td className="p-3 text-xs text-kv-muted">{[u.climate && "climate", u.inside && "inside", u.power && "power", u.vehicle && "vehicle", u.excludedFromWebsite && "hidden from web"].filter(Boolean).join(", ")}</td>
                  <td className="p-3 text-right tabular-nums">
                    {money(u.standardRate)} / {money(u.rate)}
                  </td>
                  <td className="p-3">
                    {u.rented ? (
                      <span className="badge bg-kv-navy text-white">occupied</span>
                    ) : hold ? (
                      <span className="badge bg-kv-yellow text-kv-navy">web hold · {hold.firstName}</span>
                    ) : u.waitingListReserved ? (
                      <span className="badge bg-blue-100 text-blue-800">reserved</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-800">vacant</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
