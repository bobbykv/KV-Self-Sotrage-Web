import { LocationSwitcher, PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { db } from "@/lib/db";
import { updateMaintenanceAction } from "../actions";

export const metadata = { title: "Maintenance" };

export default async function AdminMaintenance({ searchParams }: { searchParams: Promise<{ location?: string; status?: string }> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const showDone = sp.status === "done";
  const rows = await db.maintenanceRequest.findMany({
    where: { ...(location ? { locationKey: location } : {}), status: showDone ? "done" : { not: "done" } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return (
    <>
      <PageHeader title="Maintenance queue">
        <a href={`/admin/maintenance?${location ? `location=${location}&` : ""}${showDone ? "" : "status=done"}`} className="btn-ghost btn-sm">
          {showDone ? "Show open" : "Show done"}
        </a>
      </PageHeader>
      <LocationSwitcher current={location} basePath="/admin/maintenance" extra={showDone ? "status=done" : ""} />
      <div className="mt-4 grid gap-3">
        {!rows.length && <p className="text-sm text-kv-muted">Nothing {showDone ? "completed" : "open"}. 🎉</p>}
        {rows.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-kv-navy">
                  {r.issueType} · {getLocation(r.locationKey as "haley").shortName} unit {r.unitName} <StatusBadge status={r.status} />
                  {!r.verified && <span className="badge ml-1 bg-kv-yellow-light text-kv-navy">unverified tenant</span>}
                </p>
                <p className="text-sm text-kv-muted">
                  {r.name} · {[r.phone, r.email].filter(Boolean).join(" · ")} · prefers {r.contactPref.replace("_", " ")} · {r.createdAt.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="mt-2 text-sm whitespace-pre-line">{r.description}</p>
                {r.photoIds.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.photoIds.map((p) => (
                      <a key={p} href={`/api/uploads/${p}`} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/uploads/${p}`} alt="Maintenance photo" className="h-20 w-20 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <form action={updateMaintenanceAction.bind(null, r.id)} className="flex w-full flex-col gap-2 sm:w-72">
                <select name="status" defaultValue={r.status} className="input min-h-10">
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <textarea name="staffNotes" defaultValue={r.staffNotes ?? ""} rows={2} placeholder="Staff notes" className="input py-2 text-sm" />
                <button className="btn-navy btn-sm">Save</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
