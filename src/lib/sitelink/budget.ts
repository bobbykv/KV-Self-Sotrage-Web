import "server-only";
import { db } from "../db";
import { log } from "../log";

/** SiteLink pricing: 10k calls/location/month included, then $1 per 1k. */
export const INCLUDED_CALLS_PER_LOCATION = 10_000;

export function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export async function recordCall(locationKey: string, method: string, ok: boolean) {
  const month = monthKey();
  const id = `${month}:${locationKey}:${method}`;
  try {
    await db.apiCallCounter.upsert({
      where: { id },
      create: { id, month, locationKey, method, count: 1, errors: ok ? 0 : 1 },
      update: { count: { increment: 1 }, errors: { increment: ok ? 0 : 1 } },
    });
  } catch (err) {
    log.warn("call budget counter failed", { err });
  }
}

export async function usageThisMonth() {
  const rows = await db.apiCallCounter.findMany({ where: { month: monthKey() }, orderBy: { count: "desc" } });
  const byLocation: Record<string, number> = {};
  for (const r of rows) byLocation[r.locationKey] = (byLocation[r.locationKey] ?? 0) + r.count;
  return { rows, byLocation };
}
