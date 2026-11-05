import { LOCATION_KEYS, type LocationKey } from "@/config/locations";

export type InventoryKind = "available" | "all" | "pricelist" | "report";

/**
 * Live mode only. Mock and APP_TEST_MODE never call SiteLink, so they are not paused.
 * An explicit env flag wins over the admin checkbox. When the env flag is unset,
 * a missing checkbox is treated as paused so a new production database cannot
 * start calling SiteLink on its own.
 */
export function isAutomaticRefreshPaused(
  settings: { sitelinkRefreshPaused?: boolean },
  runtime: { live: boolean; envFlag: string | undefined },
): boolean {
  if (!runtime.live) return false;
  const flag = runtime.envFlag?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes" || flag === "paused") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return settings.sitelinkRefreshPaused !== false;
}

/** Keeps caller order, drops unknown or repeated keys. Empty means every location, in LOCATION_KEYS order. */
export function normalizeRefreshLocations(locations: readonly LocationKey[] | undefined): LocationKey[] {
  if (!locations?.length) return [...LOCATION_KEYS];
  const seen = new Set<LocationKey>();
  const out: LocationKey[] = [];
  for (const loc of locations) {
    if (!(LOCATION_KEYS as readonly string[]).includes(loc) || seen.has(loc)) continue;
    seen.add(loc);
    out.push(loc);
  }
  return out;
}

/** One location at a time. The next call starts only after the previous one settles. */
export async function forEachSequential<T>(items: readonly T[], fn: (item: T, index: number) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i++) await fn(items[i]!, i);
}

const PROBE_KINDS = ["available", "pricelist", "all"] as const;
export type ProbeKind = (typeof PROBE_KINDS)[number];

export function parseProbeRequest(params: { get(name: string): string | null }): { ok: true; location: LocationKey; kind: ProbeKind } | { ok: false; error: string } {
  const location = params.get("location");
  if (!location || !(LOCATION_KEYS as readonly string[]).includes(location)) {
    return { ok: false, error: "Pass one location: haley, hwy4 (Addington Forks), or stellarton." };
  }
  const kind = params.get("kind") ?? "available";
  if (!PROBE_KINDS.includes(kind as ProbeKind)) {
    return { ok: false, error: "Pass one kind: available, pricelist, or all." };
  }
  return { ok: true, location: location as LocationKey, kind: kind as ProbeKind };
}
