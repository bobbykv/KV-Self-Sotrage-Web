import type { LocationKey } from "@/config/locations";

export type Placement = "homepage" | "units" | "checkout";
export const PLACEMENTS: Placement[] = ["homepage", "units", "checkout"];

export type PromoLike = {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  locations: string[];
  placements: string[];
};

/** A promo shows only when toggled on AND inside its date window (open-ended if a date is blank). */
export function isPromoLive(p: PromoLike, now = new Date()): boolean {
  if (!p.active) return false;
  if (p.startsAt && p.startsAt > now) return false;
  if (p.endsAt && p.endsAt < now) return false;
  return true;
}

export function promoMatches(p: PromoLike, opts: { placement?: Placement; location?: LocationKey | null }): boolean {
  const placements = Array.isArray(p.placements) ? p.placements : [];
  const locations = Array.isArray(p.locations) ? p.locations : [];
  if (opts.placement && !placements.includes(opts.placement)) return false;
  if (opts.location && !(locations.includes("all") || locations.includes(opts.location))) return false;
  return true;
}

/** Converts a "YYYY-MM-DD" date picked by staff into the UTC instant for that Halifax wall-clock day boundary. */
export function halifaxDayBoundary(date: string, edge: "start" | "end"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = edge === "start" ? Date.UTC(y, m - 1, d, 0, 0, 0) : Date.UTC(y, m - 1, d, 23, 59, 59);
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Halifax", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
  };
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}

export function promoStatus(p: PromoLike, now = new Date()): "live" | "scheduled" | "ended" | "off" {
  if (!p.active) return "off";
  if (p.startsAt && p.startsAt > now) return "scheduled";
  if (p.endsAt && p.endsAt < now) return "ended";
  return "live";
}
