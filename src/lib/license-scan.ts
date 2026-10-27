/**
 * Reads a driver's licence from OCR or model text. No network and no image bytes.
 */
import { CA_PROVINCES, isRegionCode, US_STATES } from "./regions";

export type LicenseScan = {
  licenseNumber: string | null;
  licenseRegion: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
};

export function emptyLicenseScan(): LicenseScan {
  return { licenseNumber: null, licenseRegion: null, addressLine1: null, city: null, postalCode: null };
}

export function licenseScanScore(scan: LicenseScan): number {
  return [scan.licenseNumber, scan.licenseRegion, scan.addressLine1, scan.city, scan.postalCode].filter(Boolean).length;
}

export function mergeLicenseScans(primary: LicenseScan, extra: LicenseScan): LicenseScan {
  return {
    licenseNumber: primary.licenseNumber || extra.licenseNumber,
    licenseRegion: primary.licenseRegion || extra.licenseRegion,
    addressLine1: primary.addressLine1 || extra.addressLine1,
    city: primary.city || extra.city,
    postalCode: primary.postalCode || extra.postalCode,
  };
}

const POSTAL_RE = /[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d/i;
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/;
const NS_LICENSE_RE = /\b[A-Z]{4,5}-\d{5}-\d{5}\b/;
const NS_LICENSE_TIGHT_RE = /\b([A-Z]{4,5})(\d{5})(\d{5})\b/;
const STREET_RE = /^\d{1,6}\s+[A-Z0-9]/;
const STREET_BLOB_RE =
  /\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]{2,40}?\s(?:ST|STREET|RD|ROAD|AVE|AVENUE|DR|DRIVE|BLVD|LANE|LN|WAY|CRES|CRESCENT|CT|COURT|HWY|HIGHWAY|TRL|TRAIL)\b/;

const NS_TOWNS = [
  "Antigonish",
  "New Glasgow",
  "Stellarton",
  "Halifax",
  "Dartmouth",
  "Truro",
  "Sydney",
  "Amherst",
  "Pictou",
  "Westville",
  "Trenton",
  "Port Hawkesbury",
  "Kentville",
  "Bridgewater",
  "Yarmouth",
  "Windsor",
  "Wolfville",
  "Bible Hill",
  "Elmsdale",
  "Stewiacke",
  "Sherbrooke",
  "Guysborough",
  "Inverness",
  "Cheticamp",
  "Baddeck",
  "Glace Bay",
  "North Sydney",
  "Sydney Mines",
  "New Waterford",
  "Springhill",
  "Oxford",
  "Pugwash",
  "Tatamagouche",
  "Monastery",
  "Heatherton",
  "Pomquet",
  "Merigomish",
  "Thorburn",
  "Addington Forks",
];

const REGION_NAMES = [...CA_PROVINCES, ...US_STATES].sort((a, b) => b.name.length - a.name.length);

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(St|Rd|Dr|Ave|Ln|Ct|Hwy)\b/g, (word) => word);
}

function formatPostal(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(compact)) return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  return raw.toUpperCase();
}

function regionFromName(upper: string): string | null {
  for (const region of REGION_NAMES) {
    if (upper.includes(region.name.toUpperCase())) return region.code;
  }
  return null;
}

function regionNearPostal(upper: string): string | null {
  const canadian = upper.match(/\b([A-Z]{2})\s+[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]/);
  if (canadian && isRegionCode(canadian[1])) return canadian[1];
  const zip = upper.match(/\b([A-Z]{2})\s+\d{5}\b/);
  if (zip && isRegionCode(zip[1])) return zip[1];
  return null;
}

function findLicense(upper: string): string | null {
  const dashed = upper.match(NS_LICENSE_RE);
  if (dashed) return dashed[0];
  const tight = upper.match(NS_LICENSE_TIGHT_RE);
  if (tight) return `${tight[1]}-${tight[2]}-${tight[3]}`;
  const labeled = upper.match(/(?:LICEN[CS]E|DL|LIC)\.?\s*(?:NO\.?|NUMBER|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,22})/);
  if (labeled && !POSTAL_RE.test(labeled[1]) && !/^\d{5}$/.test(labeled[1])) return labeled[1];
  const us = upper.match(/\b[A-Z]\d{7,8}\b/);
  return us ? us[0] : null;
}

function cleanupCity(line: string, postal: string | null): string | null {
  let rest = line;
  if (postal) rest = rest.replace(postal, "").replace(postal.replace(/\s/g, ""), "");
  rest = rest.replace(/\b(NOVA SCOTIA|CANADA)\b/g, "");
  rest = rest.replace(/\b[A-Z]{2}\b/g, (code) => (isRegionCode(code) ? "" : code));
  rest = rest.replace(/[^A-Z .'-]/g, " ").replace(/\s+/g, " ").trim();
  if (rest.length < 2 || rest.length > 40 || STREET_RE.test(rest)) return null;
  return titleCase(rest);
}

function knownTown(text: string): string | null {
  return NS_TOWNS.slice()
    .sort((a, b) => b.length - a.length)
    .find((name) => text.toUpperCase().includes(name.toUpperCase())) ?? null;
}

function findAddress(lines: string[], postal: string | null): { addressLine1: string | null; city: string | null } {
  let postalIdx = -1;
  if (postal) {
    const compact = postal.replace(/\s/g, "");
    postalIdx = lines.findIndex((line) => line.replace(/\s/g, "").includes(compact));
  }
  let city = postalIdx >= 0 ? cleanupCity(lines[postalIdx], postal) : null;
  if (!city && postalIdx > 0) city = cleanupCity(lines[postalIdx - 1], postal);
  const near = [lines[postalIdx], lines[postalIdx - 1]].filter(Boolean).join(" ");
  const town = knownTown(near) ?? knownTown(lines.join(" "));
  if (town && (!city || (city.toUpperCase().includes(town.toUpperCase()) && city.length > town.length + 3))) city = town;

  let street: string | null = null;
  const start = postalIdx > 0 ? postalIdx - 1 : lines.length - 1;
  for (let i = start; i >= 0; i--) {
    if (STREET_RE.test(lines[i]) && !POSTAL_RE.test(lines[i])) {
      street = lines[i];
      break;
    }
  }
  if (!street) {
    const blob = lines.join(" ").match(STREET_BLOB_RE);
    street = blob ? blob[0] : null;
  }
  return { addressLine1: street ? titleCase(street.replace(/[, ]+$/g, "")).slice(0, 80) : null, city };
}

export function parseLicenseOcr(raw: string): LicenseScan {
  const upper = raw.replace(/\r/g, "\n").toUpperCase();
  const lines = upper
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const postalMatch = upper.match(POSTAL_RE);
  const zipMatch = upper.match(ZIP_RE);
  const postalCode = postalMatch ? formatPostal(postalMatch[0]) : zipMatch ? zipMatch[0] : null;
  const licenseNumber = findLicense(upper);
  const licenseRegion = regionFromName(upper) || regionNearPostal(upper);
  const address = findAddress(lines.length ? lines : [upper.replace(/\s+/g, " ").trim()], postalCode);
  return {
    licenseNumber: licenseNumber && licenseNumber.length <= 30 ? licenseNumber : null,
    licenseRegion,
    addressLine1: address.addressLine1,
    city: address.city,
    postalCode,
  };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Keeps only values that look like a real licence, region, street, city, or postal code. */
export function normalizeLicenseScan(input: unknown): LicenseScan {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const parsed = parseLicenseOcr(
    [
      asText(row.licenseNumber),
      asText(row.licenseRegion),
      asText(row.addressLine1) || asText(row.addr1),
      asText(row.city),
      asText(row.postalCode),
    ].join("\n"),
  );
  const regionText = asText(row.licenseRegion);
  const named = regionText ? regionFromName(regionText.toUpperCase()) || (isRegionCode(regionText) ? regionText.toUpperCase() : null) : null;
  return { ...parsed, licenseRegion: named || parsed.licenseRegion };
}
