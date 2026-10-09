import "server-only";
import { z } from "zod";
import { LOCATION_KEYS, getLocation, isLocationKey } from "@/config/locations";
import { db } from "./db";
import { env } from "./env";
import { log, safeErrorMessage } from "./log";
import { notifyStaff } from "./notify";

/**
 * One lead shape for every channel. Mirrors the `capture_lead` tool in
 * agent-brain/tools.json so web chat, web forms and the Retell voice agent
 * send identical fields to GoHighLevel; only `channel` differs.
 */
export const leadSchema = z.object({
  channel: z.enum(["website_form", "website_chat", "voice", "retell"]),
  reason: z.enum(["unavailable_unit", "waitlist", "contact_request", "human_handoff"]),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  locationKey: z.enum(LOCATION_KEYS).optional(),
  unitType: z.string().trim().max(120).optional(),
  unitSize: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Dedup key, e.g. retell:chat:chat_xxx from the Retell tool/webhook path. */
  externalId: z.string().trim().max(200).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

export function ghlPayload(lead: LeadInput & { id: string; createdAt: Date }) {
  const [firstName, ...rest] = lead.name.split(/\s+/);
  const location = lead.locationKey && isLocationKey(lead.locationKey) ? getLocation(lead.locationKey) : null;
  return {
    leadId: lead.id,
    firstName,
    lastName: rest.join(" "),
    name: lead.name,
    phone: lead.phone || undefined,
    email: lead.email || undefined,
    source: "website",
    channel: lead.channel,
    reason: lead.reason,
    preferredLocation: location?.shortName ?? "Any",
    preferredLocationKey: lead.locationKey ?? null,
    unitType: lead.unitType ?? null,
    unitSize: lead.unitSize ?? null,
    notes: lead.notes ?? null,
    timestamp: lead.createdAt.toISOString(),
    tags: ["kv-self-storage", `channel:${lead.channel}`, `reason:${lead.reason}`, ...(lead.locationKey ? [`location:${lead.locationKey}`] : [])],
  };
}

async function pushToGhl(payload: ReturnType<typeof ghlPayload>): Promise<void> {
  if (env.GHL_WEBHOOK_URL) {
    const res = await fetch(env.GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`GHL webhook HTTP ${res.status}`);
    return;
  }
  if (env.GHL_API_KEY && env.GHL_LOCATION_ID) {
    const headers = { Authorization: `Bearer ${env.GHL_API_KEY}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };
    const res = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId: env.GHL_LOCATION_ID,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        source: `website (${payload.channel})`,
        tags: payload.tags,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`GHL contacts/upsert HTTP ${res.status}`);
    const body = (await res.json()) as { contact?: { id?: string } };
    const contactId = body.contact?.id;
    if (contactId) {
      const note = [
        `Reason: ${payload.reason}`,
        `Preferred location: ${payload.preferredLocation}`,
        payload.unitType && `Unit type: ${payload.unitType}`,
        payload.unitSize && `Size: ${payload.unitSize}`,
        payload.notes && `Notes: ${payload.notes}`,
        `Channel: ${payload.channel} · ${payload.timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: note }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => undefined);
    }
    return;
  }
  throw new Error("GHL not configured");
}

/** Always stores the lead locally first so nothing is lost if GHL is down; staff can retry from /admin/leads. */
export async function captureLead(input: LeadInput) {
  const data = leadSchema.parse(input);
  if (!data.phone && !data.email) throw new Error("A phone number or email is required");

  if (data.externalId) {
    const existing = await db.lead.findFirst({ where: { externalId: data.externalId } });
    if (existing) {
      await db.lead.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          phone: data.phone || existing.phone,
          email: data.email || existing.email,
          locationKey: data.locationKey ?? existing.locationKey,
          unitType: data.unitType ?? existing.unitType,
          unitSize: data.unitSize ?? existing.unitSize,
          notes: data.notes ?? existing.notes,
          reason: data.reason,
        },
      });
      return sendLeadToGhl(existing.id);
    }
  }

  const lead = await db.lead.create({
    data: {
      channel: data.channel,
      reason: data.reason,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      locationKey: data.locationKey ?? null,
      unitType: data.unitType ?? null,
      unitSize: data.unitSize ?? null,
      notes: data.notes ?? null,
      externalId: data.externalId ?? null,
    },
  });
  return sendLeadToGhl(lead.id);
}

export async function sendLeadToGhl(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (env.appTestMode) {
    return db.lead.update({ where: { id: leadId }, data: { ghlStatus: "skipped", ghlError: "APP_TEST_MODE — GHL delivery blocked" } });
  }
  const configured = Boolean(env.GHL_WEBHOOK_URL || (env.GHL_API_KEY && env.GHL_LOCATION_ID));
  if (!configured) {
    return db.lead.update({ where: { id: leadId }, data: { ghlStatus: "skipped", ghlError: "GHL not configured" } });
  }
  try {
    await pushToGhl(
      ghlPayload({
        ...lead,
        channel: lead.channel as LeadInput["channel"],
        reason: lead.reason as LeadInput["reason"],
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        locationKey: isLocationKey(lead.locationKey) ? lead.locationKey : undefined,
        unitType: lead.unitType ?? undefined,
        unitSize: lead.unitSize ?? undefined,
        notes: lead.notes ?? undefined,
        externalId: lead.externalId ?? undefined,
      }),
    );
    return db.lead.update({ where: { id: leadId }, data: { ghlStatus: "sent", ghlSentAt: new Date(), ghlError: null } });
  } catch (err) {
    log.warn("GHL push failed", { leadId, err });
    await notifyStaff("lead_ghl_failed", `Lead ${lead.name} saved but not sent to GoHighLevel`, { leadId });
    return db.lead.update({ where: { id: leadId }, data: { ghlStatus: "failed", ghlError: safeErrorMessage(err) } });
  }
}
