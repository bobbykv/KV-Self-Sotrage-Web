import Link from "next/link";
import { LocationSwitcher, PageHeader, Stat } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey, type LocationKey } from "@/config/locations";
import { dashboardData } from "@/lib/admin-data";
import { addCash, SNAPSHOT_SITE_ORDER, type SizeAvailability } from "@/lib/business-snapshot";
import { money } from "@/lib/catalog";
import { env } from "@/lib/env";
import { refreshCacheAction, runReportsAction } from "./actions";

export const metadata = { title: "Dashboard" };

function ago(d: Date | null | undefined) {
  if (!d || d.getTime() === 0) return "never";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 1 ? "just now" : m < 120 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v);
const cad = (v: number | null | undefined) => (v === null || v === undefined ? "—" : money(v));
const siteLabel = (key: LocationKey) => (key === "hwy4" ? "Exit 31" : getLocation(key).shortName);

function rateLabel(row: SizeAvailability | undefined) {
  if (!row || row.rateMin === null) return "—";
  if (row.rateMax !== null && row.rateMax !== row.rateMin) return `${money(row.rateMin)}–${money(row.rateMax)}`;
  return money(row.rateMin);
}

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

      <DailySnapshot data={data} />

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
                <Stat label="Move-ins today" value={n(s.report?.moveInsToday)} sub={s.report?.moveInsMonth != null ? `${s.report.moveInsMonth} this month` : undefined} />
                <Stat label="Move-outs today" value={n(s.report?.moveOutsToday)} sub={s.report?.moveOutsMonth != null ? `${s.report.moveOutsMonth} this month` : undefined} />
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
          Vacant units every {data.settings.pollIntervalMinutes} min · all units (occupancy and the rent roll) every {data.settings.allUnitsPollMinutes} min · price list every {data.settings.priceListPollMinutes} min · reports once a day. This page reads those snapshots and does not call SiteLink.
        </p>
        <form action={refreshCacheAction.bind(null, true)} className="mt-3">
          <button className="text-sm font-semibold text-kv-red underline">Force full re-pull now (resets lngLastTimePolled)</button>
        </form>
      </section>
    </>
  );
}

function DailySnapshot({ data }: { data: Awaited<ReturnType<typeof dashboardData>> }) {
  const sites = [...data.sites].sort((a, b) => SNAPSHOT_SITE_ORDER.indexOf(a.location) - SNAPSHOT_SITE_ORDER.indexOf(b.location));
  const cash = addCash(sites.map((s) => s.cash));
  const pastDueAmount = sites.reduce((sum, s) => sum + (s.report?.pastDueAmount ?? 0), 0);
  const pastDueCount = sites.reduce((sum, s) => sum + (s.report?.pastDueCount ?? 0), 0);
  const hasReport = sites.some((s) => s.report);
  const moveInsToday = sites.reduce((sum, s) => sum + (s.report?.moveInsToday ?? 0), 0);
  const moveOutsToday = sites.reduce((sum, s) => sum + (s.report?.moveOutsToday ?? 0), 0);
  const moveInsMonth = sites.reduce((sum, s) => sum + (s.report?.moveInsMonth ?? 0), 0);
  const moveOutsMonth = sites.reduce((sum, s) => sum + (s.report?.moveOutsMonth ?? 0), 0);
  const sizeKeys = sites[0]?.sizes?.map((row) => row.key) ?? ["5x10", "10x10", "10x15", "10x20", "outdoor"];
  const sizeLabel = (key: string) => sites.flatMap((s) => s.sizes ?? []).find((row) => row.key === key)?.label ?? key;
  const loaded = sites.some((s) => s.cash);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-kv-navy">Daily business snapshot</h2>
          <p className="text-sm text-kv-muted">Where the sites stand from the last unit cache and the once-a-day report. Opening this page does not call SiteLink.</p>
        </div>
      </div>
      {!loaded && (
        <p className="mt-3 rounded-xl bg-kv-yellow-light p-3 text-sm text-kv-navy">
          The morning unit snapshot is not loaded yet. Refresh the SiteLink cache for open units and the rent roll, then run reports for past-due balances and move-ins.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Occupied 28-day rent roll" value={cad(cash?.rentRoll)} sub="Monthly / 28-day rent on occupied units" />
        <Stat label="Potential gross revenue" value={cad(cash?.potential)} sub="Every rentable unit at its current rate" />
        <Stat label="Economic occupancy" value={cash?.economicOccupancyPct != null ? `${cash.economicOccupancyPct}%` : "—"} sub="Rent roll ÷ potential gross" />
        <Stat label="Vacant unit value" value={cad(cash?.vacantValue)} sub="28-day rent sitting empty" />
        <Stat label="Past-due balance" value={hasReport ? cad(pastDueAmount) : "—"} sub={hasReport ? `${pastDueCount} tenant${pastDueCount === 1 ? "" : "s"}` : "Run reports to load"} tone={pastDueCount ? "red" : "navy"} />
        <Stat label="Move-ins" value={hasReport ? moveInsToday : "—"} sub={hasReport ? `${moveInsMonth} month to date` : "Run reports to load"} />
        <Stat label="Move-outs" value={hasReport ? moveOutsToday : "—"} sub={hasReport ? `${moveOutsMonth} month to date` : "Run reports to load"} />
        <Stat label="Sites in this snapshot" value={sites.filter((s) => s.cash).length} sub={sites.map((s) => siteLabel(s.location)).join(" · ")} />
      </div>

      <h3 className="mt-8 font-extrabold text-kv-navy">Open units by size and site</h3>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-kv-navy-50 text-left text-xs text-kv-muted">
            <tr>
              <th className="p-3">Size</th>
              {sites.map((s) => (
                <th key={s.location} className="p-3">
                  {siteLabel(s.location)}
                  <span className="mt-0.5 block font-normal">vacant / total · 28-day rate</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeKeys.map((key) => (
              <tr key={key} className="border-t border-kv-line">
                <td className="p-3 font-semibold">{sizeLabel(key)}</td>
                {sites.map((s) => {
                  const row = s.sizes?.find((item) => item.key === key);
                  return (
                    <td key={s.location} className="p-3 tabular-nums">
                      {s.sizes ? (
                        <>
                          <span className="font-bold text-kv-navy">{row?.vacant ?? 0}</span>
                          <span className="text-kv-muted"> / {row?.total ?? 0}</span>
                          <span className="mt-0.5 block text-xs text-kv-muted">{rateLabel(row)}</span>
                        </>
                      ) : (
                        <span className="text-kv-muted">Not loaded</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
