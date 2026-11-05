import "server-only";
import type { Prisma } from "@prisma/client";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { db } from "./db";
import { env } from "./env";
import { withJobLock } from "./job-lock";
import { log, safeErrorMessage } from "./log";
import { sitelink } from "./sitelink/client";
import type { ConcessionPlan } from "./sitelink/types";

const KIND = "discounts";
/** DiscountPlansRetrieve is small. Refresh it at most this often from a page. */
const DISCOUNT_TTL_MS = 6 * 60 * 60 * 1000;

function snapshotId(loc: LocationKey) {
  return `${loc}:${KIND}`;
}

async function readSnapshots(): Promise<Partial<Record<LocationKey, ConcessionPlan[]>>> {
  const snaps = await db.siteLinkSnapshot.findMany({ where: { kind: KIND } });
  const out: Partial<Record<LocationKey, ConcessionPlan[]>> = {};
  for (const snap of snaps) {
    if (Array.isArray(snap.data)) out[snap.locationKey as LocationKey] = snap.data as ConcessionPlan[];
  }
  return out;
}

async function savePlans(loc: LocationKey, plans: ConcessionPlan[], error: string | null) {
  const id = snapshotId(loc);
  await db.siteLinkSnapshot.upsert({
    where: { id },
    create: {
      id,
      locationKey: loc,
      kind: KIND,
      data: plans as unknown as Prisma.InputJsonValue,
      refreshedAt: new Date(),
      lastError: error,
      lastErrorAt: error ? new Date() : null,
    },
    update: {
      data: plans as unknown as Prisma.InputJsonValue,
      refreshedAt: new Date(),
      lastError: error,
      lastErrorAt: error ? new Date() : null,
    },
  });
}

/** One DiscountPlansRetrieve per location, in order. Saves the plans for unit cards. */
export async function refreshDiscountPlanCache(locations: readonly LocationKey[] = LOCATION_KEYS): Promise<void> {
  for (const loc of locations) {
    const report = await sitelink.discountPlans(loc);
    if (report.source !== "sitelink") {
      log.warn("discount plan refresh skipped", { location: loc, error: report.error });
      continue;
    }
    await savePlans(loc, report.plans, null);
  }
}

/**
 * Plans for unit cards and the unit page.
 * Mock mode uses the simulator (no network). Live mode uses the saved snapshot
 * and, when that snapshot is older than six hours, refreshes it one location
 * at a time. This is DiscountPlansRetrieve only, not the availability call.
 */
export async function getPublicDiscountPlans(): Promise<Partial<Record<LocationKey, ConcessionPlan[]>>> {
  if (env.sitelinkMode === "mock" || env.appTestMode) {
    const out: Partial<Record<LocationKey, ConcessionPlan[]>> = {};
    for (const loc of LOCATION_KEYS) {
      const report = await sitelink.discountPlans(loc);
      out[loc] = report.plans;
    }
    return out;
  }
  try {
    const snaps = await db.siteLinkSnapshot.findMany({ where: { kind: KIND } });
    const stale = LOCATION_KEYS.filter((loc) => {
      const snap = snaps.find((row) => row.locationKey === loc && row.refreshedAt.getTime() > 0);
      return !snap || Date.now() - snap.refreshedAt.getTime() > DISCOUNT_TTL_MS;
    });
    if (stale.length) {
      await withJobLock("discounts", 120, async () => {
        await refreshDiscountPlanCache(stale);
      });
    }
    return await readSnapshots();
  } catch (err) {
    log.warn("discount plan cache unavailable", { err: safeErrorMessage(err) });
    return {};
  }
}
