import "server-only";
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { db } from "./db";
import { env } from "./env";
import { withJobLock } from "./job-lock";
import { log, safeErrorMessage } from "./log";
import { getSettings } from "./settings";
import { refreshDiscountPlanCache } from "./discount-catalog";
import { sitelink } from "./sitelink/client";
import { soapDiagnostic, type SoapDiagnostic } from "./sitelink/diagnostics";
import { mockPriceListFor, mockUnitsFor } from "./sitelink/mock";
import { forEachSequential, isAutomaticRefreshPaused, normalizeRefreshLocations } from "./sitelink/refresh-policy";
import type { PriceListEntry, Unit } from "./sitelink/types";
import { blockingHoldWhere } from "./hold-status";

type Kind = "available" | "all" | "pricelist" | "report";
const snapshotId = (loc: LocationKey, kind: Kind) => `${loc}:${kind}`;

/**
 * Public page renders must not start SiteLink calls. A previous read path
 * scheduled a refresh after the response and then dropped the promise, and that
 * refresh called all three locations at once. Cron, staff, and the one-location
 * probe await their work instead.
 */
export const PAGE_VIEWS_START_SITELINK_REFRESH = false;

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

function refreshIsPaused(settings: { sitelinkRefreshPaused?: boolean }) {
  return isAutomaticRefreshPaused(settings, {
    live: env.sitelinkMode === "live" && !env.appTestMode,
    envFlag: process.env.SITELINK_REFRESH_PAUSED,
  });
}

export async function automaticRefreshIsPaused(): Promise<boolean> {
  return refreshIsPaused(await getSettings());
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

export type RefreshResult = {
  location: LocationKey;
  kind: Kind;
  ok: boolean;
  skipped?: boolean;
  paused?: boolean;
  count?: number;
  error?: string;
  diagnostic?: SoapDiagnostic | null;
};

export type RefreshOptions = {
  force?: boolean;
  full?: boolean;
  kinds?: Kind[];
  /** Limit the run. Omit to walk every location, one after another. */
  locations?: LocationKey[];
  /**
   * Explicit one-location test. Runs even while automatic refreshes are paused.
   * Requires exactly one known location.
   */
  probe?: boolean;
};

function pausedResults(locations: LocationKey[], kinds: Kind[]): RefreshResult[] {
  return locations.flatMap((location) => kinds.filter((kind) => kind !== "report").map((kind) => ({ location, kind, ok: true, skipped: true, paused: true })));
}

/**
 * Polls SiteLink only for snapshots that are due. Public pages never call
 * this. Staff trigger it from the dashboard; /api/cron/inventory does the same
 * when a scheduler is configured. `full` resets the delta cursor (the nightly
 * cache clear SiteLink recommends). Locations run one at a time.
 */
export async function refreshInventory(opts: RefreshOptions = {}): Promise<RefreshResult[] | null> {
  const settings = await getSettings();
  const kinds = (opts.kinds ?? ["available", "pricelist", "all"]).filter((kind) => kind !== "report");
  const locations = normalizeRefreshLocations(opts.locations);
  if (opts.probe && locations.length !== 1) {
    throw new Error("SiteLink probe requires exactly one location");
  }
  if (!opts.probe && refreshIsPaused(settings)) {
    log.info("sitelink refresh skipped", { reason: "paused", locations });
    return pausedResults(locations, kinds);
  }
  return withJobLock("inventory", 300, async () => {
    const existing = await db.siteLinkSnapshot.findMany();
    const get = (loc: LocationKey, kind: Kind) => existing.find((s) => s.id === snapshotId(loc, kind));
    const results: RefreshResult[] = [];

    await forEachSequential(locations, async (loc) => {
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
            results.push({ location: loc, kind: "available", ok: false, error: safeErrorMessage(err), diagnostic: soapDiagnostic(err) });
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
            results.push({ location: loc, kind: "pricelist", ok: false, error: safeErrorMessage(err), diagnostic: soapDiagnostic(err) });
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
            results.push({ location: loc, kind: "all", ok: false, error: safeErrorMessage(err), diagnostic: soapDiagnostic(err) });
          }
        } else results.push({ location: loc, kind: "all", ok: true, skipped: true });
      }
    });
    if (!opts.probe) await refreshDiscountPlanCache(locations);
    log.info("inventory refresh", { results: results.filter((r) => !r.skipped) });
    return results;
  });
}

/** Reporting API job (past-due, today and month-to-date moves, occupancy). Cron runs it after hours. The dashboard only reads the saved snapshot. */
export async function refreshReports() {
  const settings = await getSettings();
  if (refreshIsPaused(settings)) {
    log.info("sitelink refresh skipped", { reason: "paused", job: "reports" });
    return LOCATION_KEYS.map((location) => ({ location, kind: "report" as const, ok: true, skipped: true, paused: true }));
  }
  return withJobLock("reports", 300, async () => {
    const out: RefreshResult[] = [];
    await forEachSequential(LOCATION_KEYS, async (loc) => {
      try {
        const summary = await sitelink.dailyReports(loc, new Date());
        await saveSnapshot(loc, "report", summary);
        out.push({ location: loc, kind: "report", ok: true });
      } catch (err) {
        await saveError(loc, "report", err);
        out.push({ location: loc, kind: "report", ok: false, error: safeErrorMessage(err), diagnostic: soapDiagnostic(err) });
      }
    });
    return out;
  });
}

export type AvailabilityState = "live" | "published" | "demo" | "none";

export type LocationInventory = {
  location: LocationKey;
  units: Unit[];
  priceList: PriceListEntry[];
  refreshedAt: string | null;
  /** When the published price list last loaded. Separate from vacant-unit freshness. */
  pricesAsOf: string | null;
  lastError: string | null;
  /**
   * live — a successful availability snapshot with no current error. Units may be booked.
   * published — availability is missing or the last pull failed. priceList is real sizes
   *   and rates when we have them. units is empty so nobody can hold a sample unit.
   * demo — explicit mock / APP_TEST_MODE filled the verified sample catalog.
   * none — nothing safe to show. Ask the visitor to call.
   */
  availability: AvailabilityState;
};

type InventorySnap = { data: unknown; refreshedAt: Date; lastError?: string | null };

function listedUnits(data: unknown, loc: LocationKey, heldKey: Set<string>): Unit[] {
  return ((data as Unit[]) ?? []).filter(
    (u): u is Unit =>
      Boolean(u) &&
      !u.rented &&
      u.rentable &&
      !u.excludedFromWebsite &&
      !u.waitingListReserved &&
      !heldKey.has(`${loc}:${u.unitId}`),
  );
}

function savedPriceList(price: InventorySnap | undefined): PriceListEntry[] {
  if (!price || price.refreshedAt.getTime() === 0 || !Array.isArray(price.data)) return [];
  return price.data.filter((entry): entry is PriceListEntry => Boolean(entry) && typeof entry === "object");
}

function pricesAsOf(price: InventorySnap | undefined): string | null {
  return price && price.refreshedAt.getTime() > 0 ? price.refreshedAt.toISOString() : null;
}

/**
 * Demo units are only substituted when `allowDemo` is set (mock or APP_TEST_MODE).
 * A failed or missing live pull never invents vacant units. A saved price list is
 * still returned so the site can show sizes and published rates.
 */
export function locationInventoryFromSnapshots(
  loc: LocationKey,
  avail: InventorySnap | undefined,
  price: InventorySnap | undefined,
  heldKey: Set<string>,
  opts: { allowDemo?: boolean } = {},
): LocationInventory {
  const liveUnits = listedUnits(avail?.data, loc, heldKey);
  const availabilityOk = Boolean(avail && avail.refreshedAt.getTime() > 0 && !avail.lastError);
  const priceList = savedPriceList(price);
  if (availabilityOk && avail) {
    return {
      location: loc,
      units: liveUnits,
      priceList,
      refreshedAt: avail.refreshedAt.toISOString(),
      pricesAsOf: pricesAsOf(price),
      lastError: null,
      availability: "live",
    };
  }

  if (opts.allowDemo) {
    return {
      location: loc,
      units: mockUnitsFor(loc).filter((u) => !heldKey.has(`${loc}:${u.unitId}`)),
      priceList: priceList.length ? priceList : mockPriceListFor(loc),
      refreshedAt: null,
      pricesAsOf: pricesAsOf(price),
      lastError: null,
      availability: "demo",
    };
  }

  return {
    location: loc,
    units: [],
    priceList,
    refreshedAt: null,
    pricesAsOf: pricesAsOf(price),
    lastError: avail?.lastError || "Live availability is not loaded",
    availability: priceList.length ? "published" : "none",
  };
}

/** Counts for locations whose vacant units are real (or explicit demo). Unconfirmed locations are omitted. */
export function openUnitCounts(rows: LocationInventory[]): Record<string, number> | undefined {
  const bookable = rows.filter((row) => row.availability === "live" || row.availability === "demo");
  if (!bookable.length) return undefined;
  return Object.fromEntries(bookable.map((row) => [row.location, row.units.length]));
}

/**
 * Read path for the public site and chat: DB snapshot only, zero SiteLink
 * calls. Units under an active website hold are hidden so two visitors can't
 * hold the same unit even before SiteLink's waiting list catches up.
 */
export const getInventory = cache(async (): Promise<LocationInventory[]> => {
  const allowDemo = env.sitelinkMode === "mock" || env.appTestMode;
  try {
    const snaps = await db.siteLinkSnapshot.findMany({ where: { kind: { in: ["available", "pricelist"] } } });
    const held = await db.hold.findMany({
      where: blockingHoldWhere(),
      select: { locationKey: true, unitId: true },
    });
    const heldKey = new Set(held.map((h) => `${h.locationKey}:${h.unitId}`));
    return LOCATION_KEYS.map((loc) => {
      const avail = snaps.find((s) => s.id === snapshotId(loc, "available"));
      const price = snaps.find((s) => s.id === snapshotId(loc, "pricelist"));
      return locationInventoryFromSnapshots(loc, avail, price, heldKey, { allowDemo });
    });
  } catch (err) {
    log.error("inventory read failed", { err: safeErrorMessage(err) });
    return LOCATION_KEYS.map((loc) => locationInventoryFromSnapshots(loc, undefined, undefined, new Set(), { allowDemo }));
  }
});

export async function getSnapshots() {
  return db.siteLinkSnapshot.findMany({ orderBy: { id: "asc" } });
}
