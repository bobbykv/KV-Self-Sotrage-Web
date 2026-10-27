import type { LocationKey } from "@/config/locations";
import type { Unit } from "./sitelink/types";

export type CashSnapshot = {
  /** Sum of occupied unit rates. This is the 28-day rent roll. */
  rentRoll: number;
  /** Sum of every rentable unit rate, occupied and vacant. */
  potential: number;
  /** Rent roll divided by potential gross, as a percent. */
  economicOccupancyPct: number | null;
  /** Rate sitting on vacant rentable units. */
  vacantValue: number;
};

export type SizeAvailability = {
  key: string;
  label: string;
  vacant: number;
  total: number;
  /** Lowest and highest 28-day rate in the bucket. */
  rateMin: number | null;
  rateMax: number | null;
};

const SIZES: { key: string; label: string; width?: number; length?: number; outdoor?: boolean }[] = [
  { key: "5x10", label: "5×10", width: 5, length: 10 },
  { key: "10x10", label: "10×10", width: 10, length: 10 },
  { key: "10x15", label: "10×15", width: 10, length: 15 },
  { key: "10x20", label: "10×20", width: 10, length: 20 },
  { key: "outdoor", label: "Outdoor Parking", outdoor: true },
];

function moneyRound(n: number) {
  return Math.round(n * 100) / 100;
}

function isOutdoor(unit: Pick<Unit, "vehicle" | "typeName">) {
  return unit.vehicle || /parking|outdoor|\brv\b|boat|vehicle|trailer/i.test(unit.typeName);
}

export function sizeKeyFor(unit: Pick<Unit, "vehicle" | "typeName" | "widthFt" | "lengthFt">): string | null {
  if (isOutdoor(unit)) return "outdoor";
  const hit = SIZES.find((s) => s.width === unit.widthFt && s.length === unit.lengthFt);
  return hit?.key ?? null;
}

/** Rent roll and vacancy value from a cached all-units snapshot. No SiteLink call. */
export function cashSnapshot(units: Unit[]): CashSnapshot {
  const rentable = units.filter((u) => u.rentable);
  const occupied = rentable.filter((u) => u.rented);
  const vacant = rentable.filter((u) => !u.rented);
  const sum = (rows: Unit[]) => moneyRound(rows.reduce((total, unit) => total + (unit.rate || 0), 0));
  const rentRoll = sum(occupied);
  const potential = sum(rentable);
  return {
    rentRoll,
    potential,
    economicOccupancyPct: potential > 0 ? Math.round((rentRoll / potential) * 1000) / 10 : null,
    vacantValue: sum(vacant),
  };
}

export function openUnitsBySize(units: Unit[]): SizeAvailability[] {
  return SIZES.map((size) => {
    const rows = units.filter((u) => u.rentable && sizeKeyFor(u) === size.key);
    const rates = rows.map((u) => u.rate).filter((n) => n > 0);
    return {
      key: size.key,
      label: size.label,
      vacant: rows.filter((u) => !u.rented).length,
      total: rows.length,
      rateMin: rates.length ? Math.min(...rates) : null,
      rateMax: rates.length ? Math.max(...rates) : null,
    };
  });
}

export function addCash(rows: (CashSnapshot | null)[]): CashSnapshot | null {
  const present = rows.filter((row): row is CashSnapshot => row !== null);
  if (!present.length) return null;
  const rentRoll = moneyRound(present.reduce((s, row) => s + row.rentRoll, 0));
  const potential = moneyRound(present.reduce((s, row) => s + row.potential, 0));
  return {
    rentRoll,
    potential,
    economicOccupancyPct: potential > 0 ? Math.round((rentRoll / potential) * 1000) / 10 : null,
    vacantValue: moneyRound(present.reduce((s, row) => s + row.vacantValue, 0)),
  };
}

export const SNAPSHOT_SITE_ORDER: LocationKey[] = ["hwy4", "stellarton", "haley"];
