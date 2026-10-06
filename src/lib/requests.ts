import "server-only";
import { z } from "zod";
import { LOCATION_KEYS, getLocation, type LocationKey } from "@/config/locations";
import { db } from "./db";
import { notifyStaff } from "./notify";
import { sitelink } from "./sitelink/client";

export const ISSUE_TYPES = ["Door / lock", "Gate / access code", "Lighting", "Leak / water", "Pests", "Cleanliness", "Snow / ice", "Nokē smart lock", "Other"] as const;

export const maintenanceSchema = z.object({
  locationKey: z.enum(LOCATION_KEYS),
  unitName: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  issueType: z.enum(ISSUE_TYPES),
  description: z.string().trim().min(5).max(3000),
  contactPref: z.enum(["phone", "text", "email", "no_contact"]),
});

export const transferSchema = z.object({
  locationKey: z.enum(LOCATION_KEYS),
  currentUnitName: z.string().trim().min(1).max(30),
  direction: z.enum(["bigger", "smaller", "different_type"]),
  desiredLocation: z.enum([...LOCATION_KEYS, "same"]),
  desiredSize: z.string().trim().max(40).optional(),
  desiredFeatures: z.string().trim().max(200).optional(),
  timing: z.enum(["asap", "within_month", "flexible", "specific_date"]),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * Public "report an issue" verification: the unit must belong to a tenant
 * whose last name matches. Unverified reports are still accepted (a broken
 * gate is a broken gate) but flagged for staff.
 */
export async function verifyUnitTenant(loc: LocationKey, unitName: string, name: string): Promise<number | null> {
  const tenantId = await sitelink.tenantIdByUnitName(loc, unitName).catch(() => null);
  if (!tenantId) return null;
  const info = await sitelink.tenantInfo(loc, tenantId).catch(() => null);
  const last = name.trim().split(/\s+/).pop()?.toLowerCase();
  return info && last && info.tenant.lastName.toLowerCase() === last ? tenantId : null;
}

export async function createMaintenanceRequest(data: z.infer<typeof maintenanceSchema>, opts: { tenantId: number | null; verified: boolean; photoIds: string[] }) {
  const row = await db.maintenanceRequest.create({
    data: { ...data, email: data.email || null, phone: data.phone || null, tenantId: opts.tenantId, verified: opts.verified, photoIds: opts.photoIds },
  });
  await notifyStaff("maintenance_request", `Maintenance: ${data.issueType} at ${getLocation(data.locationKey).shortName} unit ${data.unitName}`, {
    requestId: row.id,
    verified: opts.verified,
    contactPref: data.contactPref,
  });
  return row;
}

export async function createTransferRequest(data: z.infer<typeof transferSchema>, who: { tenantId: number; name: string; email?: string; phone?: string }) {
  const row = await db.transferRequest.create({
    data: {
      ...data,
      desiredLocation: data.desiredLocation === "same" ? data.locationKey : data.desiredLocation,
      tenantId: who.tenantId,
      name: who.name,
      email: who.email || null,
      phone: who.phone || null,
    },
  });
  await notifyStaff("transfer_request", `Unit change request (${data.direction}) from ${who.name} — ${getLocation(data.locationKey).shortName} ${data.currentUnitName}`, { requestId: row.id });
  return row;
}
