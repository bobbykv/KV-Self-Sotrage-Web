import "server-only";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { INCLUDED_CALLS_PER_LOCATION, usageThisMonth } from "./sitelink/budget";
import { db } from "./db";
import { getSettings } from "./settings";
import type { ReportSummary, Unit } from "./sitelink/types";

export type SiteSummary = {
  location: LocationKey;
  totalUnits: number | null;
  occupied: number | null;
  occupancyPct: number | null;
  vacantOnWebsite: number;
  report: ReportSummary | null;
  reportAt: Date | null;
  activeHolds: number;
  confirmedAwaitingPayment: number;
  failedPayments: number;
  newLeads7d: number;
  openMaintenance: number;
  openTransfers: number;
  apiCalls: number;
  snapshots: { kind: string; refreshedAt: Date; lastError: string | null; lastErrorAt: Date | null }[];
};

export async function dashboardData(filter?: LocationKey) {
  const locations = filter ? [filter] : [...LOCATION_KEYS];
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [snaps, holds, leads, maint, transfers, usage, settings] = await Promise.all([
    db.siteLinkSnapshot.findMany({ where: { locationKey: { in: locations } } }),
    db.hold.groupBy({ by: ["locationKey", "status"], where: { locationKey: { in: locations }, OR: [{ status: { in: ["active", "confirmed_pay_separately", "payment_failed"] } }] }, _count: true }),
    db.lead.groupBy({ by: ["locationKey"], where: { createdAt: { gte: since } }, _count: true }),
    db.maintenanceRequest.groupBy({ by: ["locationKey"], where: { status: { not: "done" }, locationKey: { in: locations } }, _count: true }),
    db.transferRequest.groupBy({ by: ["locationKey"], where: { status: { not: "done" }, locationKey: { in: locations } }, _count: true }),
    usageThisMonth(),
    getSettings(),
  ]);
  const now = new Date();
  const countHold = (loc: string, status: string) => holds.find((h) => h.locationKey === loc && h.status === status)?._count ?? 0;

  const sites: SiteSummary[] = locations.map((loc) => {
    const all = snaps.find((s) => s.id === `${loc}:all`);
    const avail = snaps.find((s) => s.id === `${loc}:available`);
    const report = snaps.find((s) => s.id === `${loc}:report`);
    const allUnits = all && all.refreshedAt.getTime() > 0 ? (all.data as Unit[]) : null;
    const occupied = allUnits ? allUnits.filter((u) => u.rented).length : null;
    return {
      location: loc,
      totalUnits: allUnits?.length ?? null,
      occupied,
      occupancyPct: allUnits?.length ? Math.round(((occupied ?? 0) / allUnits.length) * 1000) / 10 : null,
      vacantOnWebsite: ((avail?.data as Unit[]) ?? []).length,
      report: report && report.refreshedAt.getTime() > 0 ? (report.data as ReportSummary) : null,
      reportAt: report && report.refreshedAt.getTime() > 0 ? report.refreshedAt : null,
      activeHolds: countHold(loc, "active"),
      confirmedAwaitingPayment: countHold(loc, "confirmed_pay_separately"),
      failedPayments: countHold(loc, "payment_failed"),
      newLeads7d: leads.find((l) => l.locationKey === loc)?._count ?? 0,
      openMaintenance: maint.find((m) => m.locationKey === loc)?._count ?? 0,
      openTransfers: transfers.find((t) => t.locationKey === loc)?._count ?? 0,
      apiCalls: usage.byLocation[loc] ?? 0,
      snapshots: snaps
        .filter((s) => s.locationKey === loc)
        .map((s) => ({ kind: s.kind, refreshedAt: s.refreshedAt, lastError: s.lastError, lastErrorAt: s.lastErrorAt })),
    };
  });

  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    sites,
    settings,
    usage,
    projectedCalls: Object.fromEntries(locations.map((l) => [l, Math.round(((usage.byLocation[l] ?? 0) / Math.max(dayOfMonth, 1)) * daysInMonth)])),
    includedCalls: INCLUDED_CALLS_PER_LOCATION,
    leadsWithoutLocation7d: leads.find((l) => l.locationKey === null)?._count ?? 0,
  };
}
