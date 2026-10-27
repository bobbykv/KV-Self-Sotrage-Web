import { LocationSwitcher, PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey, LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getDiscountToggles } from "@/lib/discount-visibility";
import { env } from "@/lib/env";
import { expireHolds } from "@/lib/holds";
import { safeErrorMessage } from "@/lib/log";
import { sitelink } from "@/lib/sitelink/client";
import type { MoveInCost, Unit } from "@/lib/sitelink/types";
import { releaseHoldAction } from "../actions";
import { StaffBooking, type BookUnit } from "./StaffBooking";

export const metadata = { title: "Holds & payments" };

const STATUSES = ["active", "confirmed_pay_separately", "payment_failed", "moved_in", "expired", "released", "error"];

export default async function AdminHolds({ searchParams }: { searchParams: Promise<{ location?: string; status?: string; sitelink?: string; unit?: string }> }) {
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const unitParam = Number(sp.unit);
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  await expireHolds();
  const holds = await db.hold.findMany({
    where: { ...(location ? { locationKey: location } : {}), ...(status ? { status } : { status: { in: ["active", "confirmed_pay_separately", "payment_failed", "error"] } }) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const showSiteLink = sp.sitelink === "1";
  const reservations = showSiteLink
    ? await Promise.all(
        (location ? [location] : [...LOCATION_KEYS]).map(async (loc) => {
          try {
            return { loc, rows: await sitelink.reservations(loc), error: null };
          } catch (err) {
            return { loc, rows: [], error: safeErrorMessage(err, 120) };
          }
        }),
      )
    : null;
  const extra = [status ? `status=${status}` : "", showSiteLink ? "sitelink=1" : "", unitParam ? `unit=${unitParam}` : ""].filter(Boolean).join("&");
  const [toggles, planReports, snaps] = await Promise.all([
    getDiscountToggles(),
    Promise.all(LOCATION_KEYS.map(async (key) => ({ key, report: await sitelink.discountPlans(key) }))),
    db.siteLinkSnapshot.findMany({ where: { kind: { in: ["all", "available"] } } }),
  ]);
  const bookUnits: BookUnit[] = [];
  for (const key of LOCATION_KEYS) {
    const all = snaps.find((s) => s.id === `${key}:all` && s.refreshedAt.getTime() > 0);
    const avail = snaps.find((s) => s.id === `${key}:available`);
    const rows = ((all?.data ?? avail?.data) as Unit[] | undefined) ?? [];
    for (const unit of rows) {
      if (unit.rented || !unit.rentable) continue;
      bookUnits.push({
        locationKey: key,
        unitId: unit.unitId,
        unitName: unit.unitName,
        typeName: unit.typeName,
        widthFt: unit.widthFt,
        lengthFt: unit.lengthFt,
        rate: unit.rate,
        unitTypeId: unit.unitTypeId,
      });
    }
  }
  const bookPlans = planReports.flatMap(({ key, report }) => report.plans.map((plan) => ({ ...plan, locationKey: key as LocationKey })));

  return (
    <>
      <PageHeader title="Website holds & payments">
        <span className="badge bg-kv-navy-50 text-kv-navy">PAYMENT_MODE = {env.PAYMENT_MODE}</span>
      </PageHeader>
      <LocationSwitcher current={location} basePath="/admin/holds" extra={extra} />
      <div className="mt-6">
        <StaffBooking
          units={bookUnits}
          plans={bookPlans}
          toggles={toggles}
          initialLocation={location}
          initialUnitId={Number.isInteger(unitParam) ? unitParam : undefined}
        />
      </div>
      <form method="get" className="mt-4 flex flex-wrap gap-2">
        {location && <input type="hidden" name="location" value={location} />}
        <select name="status" defaultValue={status ?? ""} className="input min-h-10 w-auto">
          <option value="">Needs attention (active, awaiting payment, failed)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sitelink" value="1" defaultChecked={showSiteLink} /> Also load SiteLink reservation list (live)
        </label>
        <button className="btn-ghost btn-sm min-h-10">Apply</button>
      </form>

      <div className="mt-4 grid gap-3">
        {holds.length === 0 && <p className="text-sm text-kv-muted">Nothing here.</p>}
        {holds.map((h) => {
          const cost = h.costBreakdown as unknown as MoveInCost | null;
          return (
            <article key={h.id} className="card flex flex-wrap items-start justify-between gap-4 p-4">
              <div>
                <p className="font-bold text-kv-navy">
                  {h.firstName} {h.lastName} <StatusBadge status={h.status} />
                </p>
                <p className="text-sm">
                  {getLocation(h.locationKey as LocationKey).shortName} · unit {h.unitName} · {formatSize(h.widthFt, h.lengthFt)} {h.unitTypeName} · {money(Number(h.quotedRate))}/28 days
                </p>
                <p className="text-sm text-kv-muted">
                  <a href={`tel:${h.phone}`} className="underline">
                    {h.phone}
                  </a>{" "}
                  ·{" "}
                  <a href={`mailto:${h.email}`} className="underline">
                    {h.email}
                  </a>{" "}
                  · move-in {h.moveInDate.toISOString().slice(0, 10)}
                </p>
                <p className="text-xs text-kv-muted">
                  SiteLink tenant #{h.tenantId ?? "—"} · WaitingID {h.waitingId ?? "—"} · {h.status === "active" ? "expires" : "until"} {h.expiresAt.toLocaleString("en-CA", { timeZone: "America/Halifax" })}
                  {cost && ` · total ${money(cost.total)} (HST ${money(cost.tax)}${cost.taxSource === "computed" ? ", computed locally — SiteLink returned no tax lines" : ""})`}
                  {h.paymentRef && ` · receipt ${h.paymentRef}`}
                </p>
                {h.lastFailure && <p className="mt-1 text-xs text-kv-red">Last failure: {h.lastFailure} ({h.failureCount}×)</p>}
              </div>
              {h.status === "active" && (
                <form action={releaseHoldAction.bind(null, h.id)}>
                  <button className="btn-ghost btn-sm">Release hold</button>
                </form>
              )}
            </article>
          );
        })}
      </div>

      {reservations && (
        <section className="mt-10">
          <h2 className="font-extrabold text-kv-navy">SiteLink reservations (live)</h2>
          {reservations.map((r) => (
            <div key={r.loc} className="mt-4">
              <h3 className="text-sm font-bold">{getLocation(r.loc).shortName}</h3>
              {r.error && <p className="text-sm text-kv-red">{r.error}</p>}
              <div className="card mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {r.rows.map((x) => (
                      <tr key={x.waitingId} className="border-t border-kv-line first:border-0">
                        <td className="p-2 font-mono">#{x.waitingId}</td>
                        <td className="p-2">{x.name || `tenant ${x.tenantId}`}</td>
                        <td className="p-2">{x.unitName}</td>
                        <td className="p-2">{money(x.quotedRate)}</td>
                        <td className="p-2 text-xs text-kv-muted">expires {x.expires?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                      </tr>
                    ))}
                    {!r.rows.length && !r.error && (
                      <tr>
                        <td className="p-2 text-kv-muted">No reservations</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
