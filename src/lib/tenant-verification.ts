/**
 * Checkout move-in verification. The ID photo is validated and forwarded to
 * SiteLink. It is not stored in Postgres.
 */
import { countryForRegion, isRegionCode } from "./regions";

export const ID_PHOTO_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

export type TenantVerification = {
  licenseNumber: string;
  licenseRegion: string;
  addr1: string;
  city: string;
  region: string;
  postalCode: string;
  imageBase64: string;
  fileName: string;
  mime: "image/jpeg" | "image/png";
};

export type VerificationResult = { ok: true; value: TenantVerification } | { ok: false; error: string };

const FIELD = [
  "licenseNumber",
  "licenseRegion",
  "licenseRegionOther",
  "addr1",
  "city",
  "region",
  "regionOther",
  "postalCode",
  "idPhoto",
  "idPhotoName",
] as const;

export function verificationBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FIELD) out[key] = body[key];
  return out;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveRegion(code: unknown, other: unknown, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = text(code).toUpperCase();
  const chosen = raw || "NS";
  if (chosen === "OTHER") {
    const custom = text(other);
    if (custom.length < 2 || custom.length > 40) return { ok: false, error: `Enter the ${label}.` };
    return { ok: true, value: custom };
  }
  if (!isRegionCode(chosen)) return { ok: false, error: `Choose a valid ${label}.` };
  return { ok: true, value: chosen };
}

export function decodeIdPhoto(dataUrl: string): { ok: true; base64: string; mime: "image/jpeg" | "image/png" } | { ok: false; error: string } {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return { ok: false, error: "Add a photo of your driver's license or government ID (JPEG or PNG)." };
  const mime = match[1] as "image/jpeg" | "image/png";
  const base64 = match[2].replace(/\s/g, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 32) return { ok: false, error: "That ID photo looks empty. Take another picture and try again." };
  if (bytes.length > ID_PHOTO_MAX_BYTES) return { ok: false, error: "That ID photo is too large. Use a smaller JPEG or PNG under 1.5 MB." };
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/jpeg" && !jpeg) return { ok: false, error: "That file is not a JPEG photo of your ID." };
  if (mime === "image/png" && !png) return { ok: false, error: "That file is not a PNG photo of your ID." };
  return { ok: true, base64, mime };
}

export function parseTenantVerification(input: Record<string, unknown>): VerificationResult {
  const licenseNumber = text(input.licenseNumber).replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,28}[A-Za-z0-9]$/.test(licenseNumber)) {
    return { ok: false, error: "Enter your driver's license number (4–30 letters or numbers)." };
  }
  const licenseRegion = resolveRegion(input.licenseRegion, input.licenseRegionOther, "province or state that issued your license");
  if (!licenseRegion.ok) return licenseRegion;

  const addr1 = text(input.addr1).replace(/\s+/g, " ");
  const city = text(input.city).replace(/\s+/g, " ");
  const postalCode = text(input.postalCode).toUpperCase().replace(/\s+/g, " ");
  if (addr1.length < 2 || addr1.length > 80) return { ok: false, error: "Enter your street address." };
  if (city.length < 2 || city.length > 40) return { ok: false, error: "Enter your city." };
  if (!/^[A-Z0-9][A-Z0-9 -]{1,10}[A-Z0-9]$/.test(postalCode)) return { ok: false, error: "Enter your postal code." };
  const region = resolveRegion(input.region, input.regionOther, "mailing province or state");
  if (!region.ok) return region;

  const photo = decodeIdPhoto(text(input.idPhoto));
  if (!photo.ok) return photo;

  return {
    ok: true,
    value: {
      licenseNumber,
      licenseRegion: licenseRegion.value,
      addr1,
      city,
      region: region.value,
      postalCode,
      imageBase64: photo.base64,
      fileName: photo.mime === "image/png" ? "drivers-license.png" : "drivers-license.jpg",
      mime: photo.mime,
    },
  };
}

export function verificationNote(v: TenantVerification, idPhotoUploaded: boolean): string {
  const country = countryForRegion(v.region);
  const place = [v.addr1, v.city, v.region, v.postalCode, country.country].filter(Boolean).join(", ");
  return `Checkout verification. Driver's license ${v.licenseNumber} (${v.licenseRegion}). Mailing address ${place}. ID photo ${idPhotoUploaded ? "uploaded to SiteLink" : "provided; SiteLink image upload did not complete"}.`;
}
