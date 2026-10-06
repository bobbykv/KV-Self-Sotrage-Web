import "server-only";
import type { Prisma } from "@prisma/client";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { db } from "./db";
import { withJobLock } from "./job-lock";
import { log, safeErrorMessage } from "./log";
import { getSettings } from "./settings";
import { sitelink } from "./sitelink/client";
import type { PriceListEntry, Unit } from "./sitelink/types";

type Kind = "available" | "all" | "pricelist" | "report";
const snapshotId = (loc: LocationKey, kind: Kind) => `${loc}:${kind}`;
/** After a failed first load, page views wait this long before trying SiteLink again. */
const COLD_START_RETRY_MS = 2 * 60 * 1000;

async function saveSnapshot(loc: LocationKey, kind: Kind, data: unknown, lastTimePolled?: string) {
  const id = snapshotId(loc, kind);
  const now = new Date();
  await db.siteLinkSnapshot.upsert({
    where: { id },
    create: { id, locationKey: loc, kind, data: data as Prisma.InputJsonValue, lastTimePolled, refreshedAt: now },
    update: { data: data as Prisma.InputJsonValue, lastTimePolled, refreshedAt: now, lastError: null, lastErrorAt: null },
  });
}

async function saveError(loc: LocationKey, kind: Kind, err: unknown) {
  const id = snapshotId(loc, kind);
  const msg = safeErrorMessage(err);
  await db.siteLinkSnapshot.upsert({
    where: { id },
    create: { id, locationKey: loc, kind, data: [], refreshedAt: new Date(0), lastError: msg, lastErrorAt: new Date() },
    update: { lastError: msg, lastErrorAt: new Date() },
  });
}

function isDue(refreshedAt: Date | undefined, minutes: number) {
  return !refreshedAt || Date.now() - refreshedAt.getTime() >= minutes * 60_000 - 30_000;
}

/** Applies a lngLastTimePolled delta: replace changed units, drop ones no longer vacant. */
export function mergeUnits(previous: Unit[], delta: Unit[]): Unit[] {
  const byId = new Map(previous.map((u) => [u.unitId, u]));
  for (const u of delta) {
    if (u.rented || !u.rentable) byId.delete(u.unitId);
    else byId.set(u.unitId, u);
  }
  return [...byId.values()];
}

export type RefreshResult = { location: LocationKey; kind: Kind; ok: boolean; skipped?: boolean; count?: number; error?: string };

/**
 * Polls SiteLink only for snapshots that are due. Public pages never call
 * this per request; it runs from cron (every 30 min) and the admin button.
 * `full` resets the delta cursor (the nightly cache clear SiteLink recommends).
 */
export async function refreshInventory(opts: { force?: boolean; full?: boolean; kinds?: Kind[] } = {}): Promise<RefreshResult[] | null> {
  return withJobLock("inventory", 300, async () => {
    const settings = await getSettings();
    const kinds = opts.kinds ?? ["available", "pricelist", "all"];
    const existing = await db.siteLinkSnapshot.findMany();
    const get = (loc: LocationKey, kind: Kind) => existing.find((s) => s.id === snapshotId(loc, kind));
    const results: RefreshResult[] = [];

    await Promise.all(
      LOCATION_KEYS.map(async (loc) => {
        if (kinds.includes("available")) {
          const snap = get(loc, "available");
          if (opts.force || opts.full || isDue(snap?.refreshedAt, settings.pollIntervalMinutes)) {
            try {
              const cursor = opts.full || !snap?.lastTimePolled ? "0" : snap.lastTimePolled;
              const { units, lastTimePolled } = await sitelink.availableUnits(loc, cursor);
              const merged = cursor === "0" ? units.filter((u) => !u.rented && u.rentable) : mergeUnits((snap?.data as Unit[]) ?? [], units);
              await saveSnapshot(loc, "available", merged, lastTimePolled);
              results.push({ location: loc, kind: "available", ok: true, count: merged.length });
            } catch (err) {
              await saveError(loc, "available", err);
              results.push({ location: loc, kind: "available", ok: false, error: safeErrorMessage(err) });
            }
          } else results.push({ location: loc, kind: "available", ok: true, skipped: true });
        }

        if (kinds.includes("pricelist")) {
          const snap = get(loc, "pricelist");
          if (opts.force || opts.full || isDue(snap?.refreshedAt, settings.priceListPollMinutes)) {
            try {
              const list = await sitelink.priceList(loc);
              await saveSnapshot(loc, "pricelist", list);
              results.push({ location: loc, kind: "pricelist", ok: true, count: list.length });
            } catch (err) {
              await saveError(loc, "pricelist", err);
              results.push({ location: loc, kind: "pricelist", ok: false, error: safeErrorMessage(err) });
            }
          } else results.push({ location: loc, kind: "pricelist", ok: true, skipped: true });
        }

        if (kinds.includes("all")) {
          const snap = get(loc, "all");
          if (opts.force || opts.full || isDue(snap?.refreshedAt, settings.allUnitsPollMinutes)) {
            try {
              const units = await sitelink.allUnits(loc);
              await saveSnapshot(loc, "all", units);
              results.push({ location: loc, kind: "all", ok: true, count: units.length });
            } catch (err) {
              await saveError(loc, "all", err);
              results.push({ location: loc, kind: "all", ok: false, error: safeErrorMessage(err) });
            }
          } else results.push({ location: loc, kind: "all", ok: true, skipped: true });
        }
      }),
    );
    log.info("inventory refresh", { results: results.filter((r) => !r.skipped) });
    return results;
  });
}

/** Reporting API job (past-due, move-ins/outs, occupancy). Cron runs it after hours. */
export async function refreshReports() {
  return withJobLock("reports", 300, async () => {
    const out: RefreshResult[] = [];
    for (const loc of LOCATION_KEYS) {
      try {
        const summary = await sitelink.dailyReports(loc, new Date());
        await saveSnapshot(loc, "report", summary);
        out.push({ location: loc, kind: "report", ok: true });
      } catch (err) {
        await saveError(loc, "report", err);
        out.push({ location: loc, kind: "report", ok: false, error: safeErrorMessage(err) });
      }
    }
    return out;
  });
}

export type LocationInventory = {
  location: LocationKey;
  units: Unit[];
  priceList: PriceListEntry[];
  refreshedAt: string | null;
  lastError: string | null;
};

/**
 * Read path for the public site and chat: DB snapshot only, zero SiteLink
 * calls. Units under an active website hold are hidden so two visitors can't
 * hold the same unit even before SiteLink's waiting list catches up.
 */
export async function getInventory(): Promise<LocationInventory[]> {
  let snaps = await db.siteLinkSnapshot.findMany({ where: { kind: { in: ["available", "pricelist"] } } });
  const neverLoaded = !snaps.some((s) => s.kind === "available" && s.refreshedAt.getTime() > 0);
  const failedRecently = snaps.some((s) => s.lastErrorAt && Date.now() - s.lastErrorAt.getTime() < COLD_START_RETRY_MS);
  if (neverLoaded && !failedRecently) {
    await refreshInventory({ kinds: ["available", "pricelist"] });
    snaps = await db.siteLinkSnapshot.findMany({ where: { kind: { in: ["available", "pricelist"] } } });
  }
  const held = await db.hold.findMany({
    where: { status: "active", expiresAt: { gt: new Date() } },
    select: { locationKey: true, unitId: true },
  });
  const heldKey = new Set(held.map((h) => `${h.locationKey}:${h.unitId}`));

  return LOCATION_KEYS.map((loc) => {
    const avail = snaps.find((s) => s.id === snapshotId(loc, "available"));
    const price = snaps.find((s) => s.id === snapshotId(loc, "pricelist"));
    const units = ((avail?.data as Unit[]) ?? []).filter(
      (u) => !u.rented && u.rentable && !u.excludedFromWebsite && !u.waitingListReserved && !heldKey.has(`${loc}:${u.unitId}`),
    );
    return {
      location: loc,
      units,
      priceList: (price?.data as PriceListEntry[]) ?? [],
      refreshedAt: avail && avail.refreshedAt.getTime() > 0 ? avail.refreshedAt.toISOString() : null,
      lastError: avail?.lastError ?? null,
    };
  });
}

export async function getSnapshots() {
  return db.siteLinkSnapshot.findMany({ orderBy: { id: "asc" } });
}
