import type { LocationKey } from "@/config/locations";
import type { PriceListEntry, Unit } from "./sitelink/types";

export type SizeCategory = "small" | "medium" | "large" | "parking";

export const SIZE_LABELS: Record<SizeCategory, { label: string; hint: string }> = {
  small: { label: "Small", hint: "Up to 50 sq ft · boxes, seasonal belongings, or dorm-room items" },
  medium: { label: "Medium", hint: "51–150 sq ft · apartment belongings or business stock" },
  large: { label: "Large", hint: "Over 150 sq ft · a household move or larger equipment" },
  parking: { label: "Vehicle / RV / Boat", hint: "Parking and vehicle storage" },
};

export function sizeCategory(u: Pick<Unit, "vehicle" | "widthFt" | "lengthFt">): SizeCategory {
  if (u.vehicle) return "parking";
  const area = u.widthFt * u.lengthFt;
  if (area <= 50) return "small";
  if (area <= 150) return "medium";
  return "large";
}

export type UnitGroup = {
  key: string;
  locationKey: LocationKey;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  climate: boolean;
  inside: boolean;
  power: boolean;
  vehicle: boolean;
  category: SizeCategory;
  available: number;
  fromRate: number;
  /** Cheapest available unit — what "Hold this unit" reserves. */
  bestUnitId: number;
};

export function groupKey(u: Pick<Unit, "typeName" | "widthFt" | "lengthFt" | "climate">): string {
  return `${u.typeName}|${u.widthFt}x${u.lengthFt}|${u.climate ? "c" : "n"}`.toLowerCase();
}

export function groupUnits(units: Unit[]): UnitGroup[] {
  const map = new Map<string, UnitGroup>();
  for (const u of units) {
    if (!u?.locationKey || !Number.isFinite(u.widthFt) || !Number.isFinite(u.lengthFt) || !Number.isFinite(u.rate)) continue;
    const key = `${u.locationKey}:${groupKey(u)}`;
    const g = map.get(key);
    if (!g) {
      map.set(key, {
        key,
        locationKey: u.locationKey,
        typeName: u.typeName,
        widthFt: u.widthFt,
        lengthFt: u.lengthFt,
        climate: u.climate,
        inside: u.inside,
        power: u.power,
        vehicle: u.vehicle,
        category: sizeCategory(u),
        available: 1,
        fromRate: u.rate,
        bestUnitId: u.unitId,
      });
    } else {
      g.available++;
      if (u.rate < g.fromRate) {
        g.fromRate = u.rate;
        g.bestUnitId = u.unitId;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.widthFt * a.lengthFt - b.widthFt * b.lengthFt || a.fromRate - b.fromRate);
}

/** Types SiteLink knows about at a location that currently have zero vacant units -> waitlist/lead capture. */
export function fullTypes(priceList: PriceListEntry[], groups: UnitGroup[]): PriceListEntry[] {
  const availableKeys = new Set(groups.map((g) => `${g.locationKey}:${groupKey({ typeName: g.typeName, widthFt: g.widthFt, lengthFt: g.lengthFt, climate: g.climate })}`));
  const seen = new Set<string>();
  return priceList.filter((p) => {
    const k = `${p.locationKey}:${groupKey(p)}`;
    if (availableKeys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return p.vacant === null || p.vacant === 0;
  });
}

export type UnitFilter = {
  location?: LocationKey;
  category?: SizeCategory;
  climate?: boolean;
  vehicle?: boolean;
  minArea?: number;
  maxArea?: number;
  maxRate?: number;
};

/** Size-finder ranges are inclusive and remain in place when changing location. */
export function areaRangeFromParams(sp: Record<string, string | undefined>): Pick<UnitFilter, "minArea" | "maxArea"> {
  const positive = (value: string | undefined) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return { minArea: positive(sp.minArea), maxArea: positive(sp.maxArea) };
}

export function filterFullTypes(types: PriceListEntry[], f: UnitFilter): PriceListEntry[] {
  return types.filter((p) => {
    // The price-list response has no vehicle flag, so use the same type-name
    // convention as the SiteLink unit mapper for sold-out parking types.
    const vehicle = /(parking|rv|boat|vehicle|trailer|car\b|outdoor)/i.test(p.typeName);
    const area = p.widthFt * p.lengthFt;
    if (f.location && p.locationKey !== f.location) return false;
    if (f.climate && !p.climate) return false;
    if (f.category && sizeCategory({ ...p, vehicle }) !== f.category) return false;
    if (f.vehicle !== undefined && vehicle !== f.vehicle) return false;
    if (f.minArea && area < f.minArea) return false;
    if (f.maxArea && area > f.maxArea) return false;
    return true;
  });
}

export function filterGroups(groups: UnitGroup[], f: UnitFilter): UnitGroup[] {
  return groups.filter((g) => {
    const area = g.widthFt * g.lengthFt;
    if (f.location && g.locationKey !== f.location) return false;
    if (f.category && g.category !== f.category) return false;
    if (f.climate && !g.climate) return false;
    if (f.vehicle !== undefined && g.vehicle !== f.vehicle) return false;
    if (f.minArea && area < f.minArea) return false;
    if (f.maxArea && area > f.maxArea) return false;
    if (f.maxRate && g.fromRate > f.maxRate) return false;
    return true;
  });
}

export function formatSize(w: number, l: number): string {
  return `${w}′ × ${l}′`;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}
