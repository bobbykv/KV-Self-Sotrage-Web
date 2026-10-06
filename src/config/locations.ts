import seed from "../../location-seed.json";

export const LOCATION_KEYS = ["haley", "hwy4", "stellarton"] as const;
export type LocationKey = (typeof LOCATION_KEYS)[number];

export type Location = {
  key: LocationKey;
  name: string;
  shortName: string;
  /** Full card headline, e.g. "Antigonish: Haley Road". */
  cardTitle: string;
  street: string;
  city: string;
  region: string;
  country: string;
  landmark?: string;
  blurb: string;
  access: string;
  officeHours: { days: string; open: string; close: string }[];
  amenities: {
    climateControlled: boolean | null;
    vehicleParking: boolean | null;
    nokeRemoteUnlock: boolean;
    gatedAccess: boolean;
    surveillance: boolean;
  };
  serves: string[];
};

export const BRAND = seed.brand;
export const LOCATIONS = seed.locations as Location[];

export function isLocationKey(value: unknown): value is LocationKey {
  return typeof value === "string" && (LOCATION_KEYS as readonly string[]).includes(value);
}

export function getLocation(key: LocationKey): Location {
  const loc = LOCATIONS.find((l) => l.key === key);
  if (!loc) throw new Error(`Unknown location ${key}`);
  return loc;
}

export function formatHours(h: { open: string; close: string }): string {
  const fmt = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const suffix = hh >= 12 ? "pm" : "am";
    const h12 = ((hh + 11) % 12) + 1;
    return mm ? `${h12}:${String(mm).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
  };
  return `${fmt(h.open)} to ${fmt(h.close)}`;
}

/** e.g. "Monday to Friday, 8:30am to 4:30pm" */
export function formatOfficeHours(l: Location): string {
  return l.officeHours.map((h) => `${h.days}, ${formatHours(h)}`).join("; ");
}

export function fullAddress(l: Location): string {
  return `${l.street}, ${l.city}, ${l.region}`;
}
