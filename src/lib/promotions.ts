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
  if (opts.placement && !p.placements.includes(opts.placement)) return false;
  if (opts.location && !(p.locations.includes("all") || p.locations.includes(opts.location))) return false;
  return true;
}

export function promoStatus(p: PromoLike, now = new Date()): "live" | "scheduled" | "ended" | "off" {
  if (!p.active) return "off";
  if (p.startsAt && p.startsAt > now) return "scheduled";
  if (p.endsAt && p.endsAt < now) return "ended";
  return "live";
}
