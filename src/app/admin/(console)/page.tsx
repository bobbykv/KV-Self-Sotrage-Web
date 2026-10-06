import Link from "next/link";
import { LocationSwitcher, PageHeader, Stat } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { dashboardData } from "@/lib/admin-data";
import { env } from "@/lib/env";
import { refreshCacheAction, runReportsAction } from "./actions";

export const metadata = { title: "Dashboard" };

function ago(d: Date | null | undefined) {
  if (!d || d.getTime() === 0) return "never";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 1 ? "just now" : m < 120 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const data = await dashboardData(location);
  const totals = data.sites.reduce(
    (t, s) => ({
      holds: t.holds + s.activeHolds,
      confirmed: t.confirmed + s.confirmedAwaitingPayment,
      failed: t.failed + s.failedPayments,
      maint: t.maint + s.openMaintenance,
      transfers: t.transfers + s.openTransfers,
      pastDue: t.pastDue + (s.report?.pastDueCount ?? 0),
    }),
    { holds: 0, confirmed: 0, failed: 0, maint: 0, transfers: 0, pastDue: 0 },
  );

  return (
    <>
      <PageHeader title="Dashboard">
        <form action={refreshCacheAction.bind(null, false)}>
          <button className="btn-navy btn-sm">Refresh SiteLink cache</button>
        </form>
        <form action={runReportsAction}>
          <button className="btn-ghost btn-sm">Run reports now</button>
        </form>
      </PageHeader>
      <LocationSwitcher current={location} basePath="/admin" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Website holds (live)" value={totals.holds} />
        <Stat label="Reserved, awaiting payment" value={totals.confirmed} sub={env.PAYMENT_MODE === "pay_separately" ? "collect payment" : undefined} />
        <Stat label="Failed web payments" value={totals.failed} tone={totals.failed ? "red" : "navy"} />
        <Stat label="Past-due tenants" value={totals.pastDue} tone={totals.pastDue ? "red" : "navy"} sub="from nightly report" />
        <Stat label="Open maintenance" value={totals.maint} tone={totals.maint ? "red" : "navy"} />
        <Stat label="Unit-change requests" value={totals.transfers} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {data.sites.map((s) => {
          const loc = getLocation(s.location);
          const avail = s.snapshots.find((x) => x.kind === "available");
          const errors = s.snapshots.filter((x) => x.lastError);
          const pct = Math.round((s.apiCalls / data.includedCalls) * 100);
          return (
            <section key={s.location} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-kv-navy">{loc.shortName}</h2>
                  <p className="text-xs text-kv-muted">{loc.street}</p>
                </div>
                <Link href={`/admin/units?location=${s.location}`} className="text-sm font-semibold text-kv-red underline">
                  Units
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Occupancy" value={s.occupancyPct !== null ? `${s.occupancyPct}%` : s.report?.occupancyPct !== null && s.report?.occupancyPct !== undefined ? `${s.report.occupancyPct}%` : "—"} sub={s.totalUnits !== null ? `${s.occupied}/${s.totalUnits} units` : undefined} />
                <Stat label="Vacant (web)" value={s.vacantOnWebsite} />
                <Stat label="Past due" value={n(s.report?.pastDueCount)} sub={s.report?.pastDueAmount ? `$${s.report.pastDueAmount.toFixed(2)}` : undefined} tone={(s.report?.pastDueCount ?? 0) > 0 ? "red" : "navy"} />
                <Stat label="Move-ins today" value={n(s.report?.moveInsToday)} />
                <Stat label="Move-outs today" value={n(s.report?.moveOutsToday)} />
                <Stat label="Live holds" value={s.activeHolds} />
              </div>
              <dl className="mt-4 space-y-1 text-xs text-kv-muted">
                <div className="flex justify-between">
                  <dt>Vacant-units poll</dt>
                  <dd>{ago(avail?.refreshedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Reports</dt>
                  <dd>{ago(s.reportAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>SiteLink calls this month</dt>
                  <dd className={pct > 80 ? "font-bold text-kv-red" : ""}>
                    {s.apiCalls.toLocaleString()} / {data.includedCalls.toLocaleString()} · projected {data.projectedCalls[s.location]?.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-kv-line">
                <div className={`h-full ${pct > 80 ? "bg-kv-red" : "bg-kv-navy"}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              {errors.map((e) => (
                <p key={e.kind} className="mt-3 rounded-lg bg-kv-red-50 p-2 text-xs text-kv-red">
                  {e.kind}: {e.lastError} ({ago(e.lastErrorAt)})
                </p>
              ))}
            </section>
          );
        })}
      </div>

      <section className="card mt-6 p-5 text-sm">
        <h2 className="font-extrabold text-kv-navy">Polling</h2>
        <p className="mt-1 text-kv-muted">
          Vacant units every {data.settings.pollIntervalMinutes} min · all units (occupancy) every {data.settings.allUnitsPollMinutes} min · price list every {data.settings.priceListPollMinutes} min · reports nightly. Full cache reset nightly.
        </p>
        <form action={refreshCacheAction.bind(null, true)} className="mt-3">
          <button className="text-sm font-semibold text-kv-red underline">Force full re-pull now (resets lngLastTimePolled)</button>
        </form>
      </section>
    </>
  );
}
