import "server-only";
import { db } from "./db";

export type Settings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  holdMinutes: number;
  /** Public vacant-unit poll (UnitsInformationAvailableUnitsOnly_v2). */
  pollIntervalMinutes: number;
  /** Staff all-units poll (UnitsInformation_v3) for occupancy. */
  allUnitsPollMinutes: number;
  priceListPollMinutes: number;
  /** Pay-separately mode: how long a confirmed website reservation stays on the SiteLink waiting list. */
  confirmedReservationHours: number;
  chatEnabled: boolean;
  /** When false, hide reviews block, /reviews page link, and reviews nav. */
  showReviews: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  maintenanceMode: false,
  maintenanceMessage: "Online booking is temporarily unavailable. Call (902) 867-3779 for help choosing or arranging your storage.",
  holdMinutes: 20,
  pollIntervalMinutes: 30,
  allUnitsPollMinutes: 120,
  priceListPollMinutes: 360,
  confirmedReservationHours: 48,
  chatEnabled: true,
  showReviews: false,
};

const LIMITS: Partial<Record<keyof Settings, [number, number]>> = {
  holdMinutes: [5, 60],
  pollIntervalMinutes: [30, 720],
  allUnitsPollMinutes: [30, 1440],
  priceListPollMinutes: [30, 1440],
  confirmedReservationHours: [1, 168],
};

export async function getSettings(): Promise<Settings> {
  try {
    const row = await db.setting.findUnique({ where: { key: "app" } });
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  for (const [key, [min, max]] of Object.entries(LIMITS) as [keyof Settings, [number, number]][]) {
    const v = Number(next[key]);
    (next as Record<string, unknown>)[key] = Math.min(max, Math.max(min, Number.isFinite(v) ? v : (DEFAULT_SETTINGS[key] as number)));
  }
  await db.setting.upsert({ where: { key: "app" }, create: { key: "app", value: next }, update: { value: next } });
  return next;
}
