import Link from "next/link";
import { LocationSwitcher, PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { db } from "@/lib/db";
import { updateTransferAction } from "../actions";

export const metadata = { title: "Unit changes" };

const TIMING: Record<string, string> = { asap: "ASAP", within_month: "within a month", flexible: "flexible", specific_date: "specific date (see notes)" };

export default async function AdminTransfers({ searchParams }: { searchParams: Promise<{ location?: string; status?: string }> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const showDone = sp.status === "done";
  const rows = await db.transferRequest.findMany({
    where: { ...(location ? { locationKey: location } : {}), status: showDone ? "done" : { not: "done" } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return (
    <>
      <PageHeader title="Unit-change requests">
        <a href={`/admin/transfers?${location ? `location=${location}&` : ""}${showDone ? "" : "status=done"}`} className="btn-ghost btn-sm">
          {showDone ? "Show open" : "Show done"}
        </a>
      </PageHeader>
      <p className="-mt-3 mb-4 text-sm text-kv-muted">Requests don&apos;t change anything in SiteLink. Do the transfer in SiteLink, then mark it done here.</p>
      <LocationSwitcher current={location} basePath="/admin/transfers" extra={showDone ? "status=done" : ""} />
      <div className="mt-4 grid gap-3">
        {!rows.length && <p className="text-sm text-kv-muted">Nothing {showDone ? "completed" : "open"}.</p>}
        {rows.map((r) => (
          <article key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <p className="font-bold text-kv-navy">
                {r.name} wants a {r.direction.replace("_", " ")} unit <StatusBadge status={r.status} />
              </p>
              <p className="text-sm">
                Now: {getLocation(r.locationKey as "haley").shortName} {r.currentUnitName} → {isLocationKey(r.desiredLocation) ? getLocation(r.desiredLocation).shortName : r.desiredLocation}
                {r.desiredSize && ` · ${r.desiredSize}`} · {TIMING[r.timing] ?? r.timing}
              </p>
              <p className="text-sm text-kv-muted">
                {[r.phone, r.email].filter(Boolean).join(" · ")} · {r.createdAt.toLocaleDateString("en-CA")}
              </p>
              {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
              <Link href={`/admin/units?location=${isLocationKey(r.desiredLocation) ? r.desiredLocation : r.locationKey}&status=vacant${r.desiredSize ? `&q=${encodeURIComponent(r.desiredSize)}` : ""}`} className="mt-2 inline-block text-sm font-semibold text-kv-red underline">
                See vacant units
              </Link>
            </div>
            <form key={`${r.status}:${r.updatedAt.getTime()}`} action={updateTransferAction.bind(null, r.id)} className="flex w-full flex-col gap-2 sm:w-72">
              <select name="status" defaultValue={r.status} className="input min-h-10">
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <textarea name="staffNotes" defaultValue={r.staffNotes ?? ""} rows={2} placeholder="Staff notes" className="input py-2 text-sm" />
              <button className="btn-navy btn-sm">Save</button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
