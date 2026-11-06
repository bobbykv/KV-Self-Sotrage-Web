import { getLocation, type LocationKey } from "@/config/locations";
import type { CostLine, PriceListEntry, Unit } from "./sitelink/types";

export type SizeCategory = "small" | "medium" | "large" | "parking";

export const SIZE_LABELS: Record<SizeCategory, { label: string; hint: string }> = {
  small: { label: "Small", hint: "Up to 50 sq ft · boxes, seasonal belongings, or dorm-room items" },
  medium: { label: "Medium", hint: "51–150 sq ft · apartment belongings or business stock" },
  large: { label: "Large", hint: "Over 150 sq ft · a household move or larger equipment" },
  parking: { label: "Vehicle / RV / Boat", hint: "Parking and vehicle storage" },
};

/** Exit 31 winter outdoor storage is a 6-period prepaid package, not one 28-day charge. */
export function isWinterStoragePackage(typeName: string): boolean {
  return /winter storage/i.test(typeName);
}

/**
 * Price shown on the public site: SiteLink's standard rate (dcStdRate), unchanged.
 * dcWebRate is not substituted and the number is not converted to a 28-day amount.
 * If a row has no positive standard rate, the only other rate we have is used.
 */
export function publicMonthlyRate(source: { standardRate?: number | null; rate?: number | null; webRate?: number | null }): number {
  const standard = Number(source.standardRate);
  if (Number.isFinite(standard) && standard > 0) return standard;
  const fallback = Number(source.webRate ?? source.rate);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

export function hasPublicDimensions(source: { widthFt: number; lengthFt: number }): boolean {
  return Number.isFinite(source.widthFt) && source.widthFt > 0 && Number.isFinite(source.lengthFt) && source.lengthFt > 0;
}

/** Malformed/placeholder rows must never become a public unit or hold link. */
export function isPublicUnit(unit: Unit): boolean {
  return Boolean(unit) && Number.isInteger(unit.unitId) && unit.unitId > 0 && hasPublicDimensions(unit) && publicMonthlyRate(unit) > 0;
}

/** Some SiteLink type names contain the facility name instead of a storage type. */
export function storageTypeLabel(unit: Pick<Unit, "locationKey" | "typeName" | "climate" | "inside" | "vehicle">): string {
  const loc = getLocation(unit.locationKey);
  const name = unit.typeName.trim();
  const facilityName = /^stellerton$/i.test(name) || [loc.shortName, loc.city, loc.street].some((label) => name.toLowerCase().includes(label.toLowerCase()));
  if (name && (!facilityName || isWinterStoragePackage(name))) return name;
  if (unit.climate) return "Climate-controlled";
  if (unit.vehicle) return "Vehicle, RV & boat parking";
  return unit.inside ? "Indoor" : "Drive-up";
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

/** Rent SiteLink put on the move-in cost. Null when that quote has no rent line. */
export function billedRentAmount(lines: Pick<CostLine, "kind" | "amount">[] | null | undefined): number | null {
  if (!lines?.length) return null;
  const rent = lines.filter((line) => line.kind === "rent" && line.amount > 0);
  if (!rent.length) return null;
  return rent.reduce((sum, line) => sum + line.amount, 0);
}

/** dcQuotedRate sent on a reservation or move-in. The standard rate the customer was shown. */
export function quotedStandardRate(source: { standardRate?: number | null; rate?: number | null; webRate?: number | null }): number {
  return publicMonthlyRate(source);
}

/**
 * Staff/log guard. Null when SiteLink's rent line matches the standard rate,
 * including when a concession is a separate discount line on that rent.
 * Does not change the amount.
 */
export function standardRateDrift(standardRate: number, lines: Pick<CostLine, "kind" | "amount">[] | null | undefined): string | null {
  const rent = billedRentAmount(lines);
  if (rent == null || !(standardRate > 0)) return null;
  const discount = (lines ?? []).filter((line) => line.kind === "discount").reduce((sum, line) => sum + Math.abs(line.amount), 0);
  if (cents(rent) === cents(standardRate) || cents(rent) + cents(discount) === cents(standardRate)) return null;
  return `SiteLink move-in rent is ${money(rent)}, not the standard rate ${money(standardRate)} that was quoted.`;
}

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

/** A published size and rate. Not a vacant unit — there is no unit id to hold. */
export type PublishedRate = {
  key: string;
  locationKey: LocationKey;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  climate: boolean;
  inside: boolean;
  power: boolean;
  vehicle: boolean;
  fromRate: number;
};

const VEHICLE_RE = /(parking|rv|boat|vehicle|trailer|car\b|outdoor)/i;

/** One card per size. Uses the SiteLink standard rate (dcStdRate). */
export function publishedRates(entries: PriceListEntry[]): PublishedRate[] {
  const seen = new Set<string>();
  const out: PublishedRate[] = [];
  for (const p of entries) {
    const fromRate = publicMonthlyRate(p);
    if (!fromRate || !hasPublicDimensions(p)) continue;
    const vehicle = VEHICLE_RE.test(p.typeName);
    const rate: PublishedRate = {
      key: `${p.locationKey}:${groupKey(p)}`,
      locationKey: p.locationKey,
      typeName: p.typeName || "Storage unit",
      widthFt: p.widthFt,
      lengthFt: p.lengthFt,
      climate: p.climate,
      // The price list has no indoor flag. Climate-controlled units are not labeled drive-up.
      inside: p.climate,
      power: false,
      vehicle,
      fromRate,
    };
    if (seen.has(rate.key)) continue;
    seen.add(rate.key);
    out.push(rate);
  }
  return out.sort((a, b) => a.widthFt * a.lengthFt - b.widthFt * b.lengthFt || a.fromRate - b.fromRate);
}

export function filterPublished(rates: PublishedRate[], f: UnitFilter): PublishedRate[] {
  return rates.filter((p) => {
    const area = p.widthFt * p.lengthFt;
    if (f.location && p.locationKey !== f.location) return false;
    if (f.category && sizeCategory(p) !== f.category) return false;
    if (f.climate && !p.climate) return false;
    if (f.vehicle !== undefined && p.vehicle !== f.vehicle) return false;
    if (f.minArea && area < f.minArea) return false;
    if (f.maxArea && area > f.maxArea) return false;
    if (f.maxRate && p.fromRate > f.maxRate) return false;
    return true;
  });
}

export function groupUnits(units: Unit[]): UnitGroup[] {
  const map = new Map<string, UnitGroup>();
  for (const u of units) {
    if (!isPublicUnit(u)) continue;
    const key = `${u.locationKey}:${groupKey(u)}`;
    const price = publicMonthlyRate(u);
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
        fromRate: price,
        bestUnitId: u.unitId,
      });
    } else {
      g.available++;
      if (price < g.fromRate) {
        g.fromRate = price;
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
    if (!hasPublicDimensions(p)) return false;
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
