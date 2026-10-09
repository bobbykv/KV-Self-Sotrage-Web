import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LOCATION_KEYS, isLocationKey, type LocationKey } from "@/config/locations";
import { type LeadInput, sendLeadToGhl } from "./leads";
import { env } from "./env";
import { db } from "./db";
import { log, safeErrorMessage } from "./log";

/** Retell signs webhooks as `v=<unix_ms>,d=<hmac_sha256_hex>` of `rawBody + timestamp`. */
export function verifyRetellSignature(rawBody: string, apiKey: string, signature: string, now = Date.now()): boolean {
  const match = /^v=(\d+),d=([0-9a-f]+)$/i.exec(signature.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  const digest = match[2];
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60_000) return false;
  const expected = createHmac("sha256", apiKey).update(rawBody + String(timestamp)).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type Loose = Record<string, unknown>;

function asObj(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function asStr(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function pickStr(obj: Loose, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = asStr(obj[key]);
    if (v) return v;
  }
  return undefined;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

function extractFromText(text: string | undefined) {
  if (!text) return {} as { email?: string; phone?: string };
  return {
    email: text.match(EMAIL_RE)?.[0],
    phone: text.match(PHONE_RE)?.[0]?.replace(/[^\d+]/g, ""),
  };
}

function resolveLocation(value: string | undefined): LocationKey | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (isLocationKey(lower)) return lower;
  for (const key of LOCATION_KEYS) {
    if (lower.includes(key)) return key;
  }
  if (lower.includes("haley") || lower.includes("antigonish")) return "haley";
  if (lower.includes("stellarton") || lower.includes("pictou")) return "stellarton";
  if (lower.includes("highway") || lower.includes("hwy") || lower.includes("addington") || lower.includes("exit 31")) return "hwy4";
  return undefined;
}

export type RetellSession = {
  kind: "chat" | "call";
  id: string;
  agentId?: string;
  channel: LeadInput["channel"];
  transcript?: string;
  summary?: string;
  sentiment?: string;
  successful?: boolean;
  custom?: Loose;
  fromNumber?: string;
  toNumber?: string;
};

/** Normalize Retell chat_* and call_* webhook bodies into one shape. */
export function parseRetellWebhook(body: Loose): { event: string; session: RetellSession | null } {
  const event = asStr(body.event) ?? "";
  const chat = asObj(body.chat);
  const call = asObj(body.call);
  const isChat = Boolean(chat.chat_id) || event.startsWith("chat_");
  const sessionObj = isChat ? chat : call;
  if (!Object.keys(sessionObj).length) return { event, session: null };

  const analysis = asObj(sessionObj.chat_analysis ?? sessionObj.call_analysis);
  const custom = asObj(analysis.custom_analysis_data);
  const dynamics = asObj(sessionObj.retell_llm_dynamic_variables ?? sessionObj.collected_dynamic_variables);
  const id = asStr(sessionObj.chat_id) ?? asStr(sessionObj.call_id);
  if (!id) return { event, session: null };

  return {
    event,
    session: {
      kind: isChat ? "chat" : "call",
      id,
      agentId: asStr(sessionObj.agent_id),
      channel: isChat ? "website_chat" : "retell",
      transcript: asStr(sessionObj.transcript),
      summary: asStr(analysis.chat_summary ?? analysis.call_summary),
      sentiment: asStr(analysis.user_sentiment),
      successful:
        typeof analysis.call_successful === "boolean"
          ? analysis.call_successful
          : typeof analysis.chat_successful === "boolean"
            ? (analysis.chat_successful as boolean)
            : undefined,
      custom: { ...dynamics, ...custom },
      fromNumber: asStr(sessionObj.from_number),
      toNumber: asStr(sessionObj.to_number),
    },
  };
}

export function leadFromRetellSession(session: RetellSession): LeadInput | null {
  const custom = session.custom ?? {};
  const fromText = extractFromText([session.transcript, session.summary, JSON.stringify(custom)].filter(Boolean).join("\n"));
  const joinedName = [pickStr(custom, ["first_name", "firstName"]), pickStr(custom, ["last_name", "lastName"])].filter(Boolean).join(" ").trim();
  const name =
    pickStr(custom, ["name", "customer_name", "full_name", "contact_name"]) ??
    (joinedName || undefined) ??
    (session.kind === "chat" ? "Website chat visitor" : "Phone caller");
  const phone = pickStr(custom, ["phone", "phone_number", "mobile", "from_number"]) ?? session.fromNumber ?? fromText.phone;
  const email = pickStr(custom, ["email", "email_address"]) ?? fromText.email;
  if (!phone && !email) return null;

  const locationKey = resolveLocation(pickStr(custom, ["location", "preferred_location", "location_key", "locationKey"]));
  const reasonRaw = pickStr(custom, ["reason", "lead_reason"]) ?? "contact_request";
  const reason = (["unavailable_unit", "waitlist", "contact_request", "human_handoff"].includes(reasonRaw) ? reasonRaw : "contact_request") as LeadInput["reason"];

  const notes = [
    session.summary && `Summary: ${session.summary}`,
    session.sentiment && `Sentiment: ${session.sentiment}`,
    pickStr(custom, ["notes", "interest", "message"]),
    session.transcript && `Transcript:\n${session.transcript.slice(0, 1800)}`,
    `Retell ${session.kind}_id: ${session.id}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);

  return {
    channel: session.channel,
    reason,
    name: name.slice(0, 120),
    phone,
    email,
    locationKey,
    unitType: pickStr(custom, ["unit_type", "unitType", "type"]),
    unitSize: pickStr(custom, ["unit_size", "unitSize", "size"]),
    notes,
  };
}

/** Full conversation payload for a GHL workflow webhook (transcript + analysis + contact). */
export function retellGhlPayload(event: string, session: RetellSession) {
  const lead = leadFromRetellSession(session);
  return {
    source: "retell",
    event,
    kind: session.kind,
    retellId: session.id,
    agentId: session.agentId,
    channel: session.channel,
    fromNumber: session.fromNumber,
    toNumber: session.toNumber,
    summary: session.summary,
    sentiment: session.sentiment,
    successful: session.successful,
    transcript: session.transcript,
    custom: session.custom,
    contact: lead
      ? {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          locationKey: lead.locationKey,
          unitType: lead.unitType,
          unitSize: lead.unitSize,
          reason: lead.reason,
          notes: lead.notes,
        }
      : null,
    tags: ["kv-self-storage", "retell", `channel:${session.channel}`, `retell:${session.kind}`],
    timestamp: new Date().toISOString(),
  };
}

async function postGhlWebhook(payload: unknown): Promise<void> {
  if (!env.GHL_WEBHOOK_URL) throw new Error("GHL webhook not configured");
  const res = await fetch(env.GHL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GHL webhook HTTP ${res.status}`);
}

export function shouldSyncRetellEvent(event: string): boolean {
  return event === "chat_ended" || event === "chat_analyzed" || event === "call_ended" || event === "call_analyzed";
}

/**
 * Push every finished Retell chat/call to GoHighLevel:
 * 1) full conversation to GHL_WEBHOOK_URL (workflow gets transcript + contact)
 * 2) contact row in /admin/leads; LeadConnector upsert when API key is set
 */
export async function syncRetellSessionToGhl(event: string, session: RetellSession) {
  if (env.appTestMode) {
    return { ok: true as const, skipped: "APP_TEST_MODE" as const, leadId: null as string | null };
  }

  const externalId = `retell:${session.kind}:${session.id}`;
  const existing = await db.lead.findFirst({ where: { externalId } });
  const payload = retellGhlPayload(event, session);

  let webhookOk = false;
  let webhookError: string | null = null;
  if (env.GHL_WEBHOOK_URL) {
    try {
      await postGhlWebhook(payload);
      webhookOk = true;
    } catch (err) {
      webhookError = safeErrorMessage(err);
      log.warn("Retell→GHL webhook failed", { externalId, err });
    }
  }

  const leadInput = leadFromRetellSession(session);
  if (!leadInput) {
    return {
      ok: !env.GHL_WEBHOOK_URL || webhookOk,
      webhookOk,
      webhookError,
      leadId: existing?.id ?? null,
      contact: false,
    };
  }

  if (existing) {
    await db.lead.update({
      where: { id: existing.id },
      data: {
        notes: leadInput.notes ?? existing.notes,
        ...(webhookOk ? { ghlStatus: "sent", ghlSentAt: new Date(), ghlError: null } : {}),
        ...(!webhookOk && webhookError ? { ghlStatus: "failed", ghlError: webhookError } : {}),
      },
    });
    // API-only setups (or webhook failed): retry contact upsert.
    if ((!env.GHL_WEBHOOK_URL || !webhookOk) && env.GHL_API_KEY && env.GHL_LOCATION_ID) {
      await sendLeadToGhl(existing.id);
    }
    return { ok: true, webhookOk, webhookError, leadId: existing.id, contact: true, deduped: true };
  }

  const lead = await db.lead.create({
    data: {
      channel: leadInput.channel,
      reason: leadInput.reason,
      name: leadInput.name,
      phone: leadInput.phone || null,
      email: leadInput.email || null,
      locationKey: leadInput.locationKey ?? null,
      unitType: leadInput.unitType ?? null,
      unitSize: leadInput.unitSize ?? null,
      notes: leadInput.notes ?? null,
      externalId,
      ghlStatus: webhookOk ? "sent" : env.GHL_WEBHOOK_URL || (env.GHL_API_KEY && env.GHL_LOCATION_ID) ? "pending" : "skipped",
      ghlSentAt: webhookOk ? new Date() : null,
      ghlError: webhookError ?? (env.GHL_WEBHOOK_URL || (env.GHL_API_KEY && env.GHL_LOCATION_ID) ? null : "GHL not configured"),
    },
  });

  // LeadConnector contact upsert when API is configured. Skip a second webhook post —
  // the rich Retell payload already went to GHL_WEBHOOK_URL above.
  if (env.GHL_API_KEY && env.GHL_LOCATION_ID) {
    const prevWebhook = env.GHL_WEBHOOK_URL;
    try {
      // Temporarily prefer API path inside sendLeadToGhl by clearing webhook in a local call:
      // sendLeadToGhl always prefers webhook first, so call the API path via a dedicated push when webhook already succeeded.
      if (prevWebhook && webhookOk) {
        await upsertGhlContact(leadInput);
        await db.lead.update({ where: { id: lead.id }, data: { ghlStatus: "sent", ghlSentAt: new Date(), ghlError: null } });
      } else {
        await sendLeadToGhl(lead.id);
      }
    } catch (err) {
      log.warn("Retell→GHL contact upsert failed", { leadId: lead.id, err });
    }
  } else if (!webhookOk) {
    await sendLeadToGhl(lead.id);
  }

  return { ok: true, webhookOk, webhookError, leadId: lead.id, contact: true };
}

async function upsertGhlContact(lead: LeadInput) {
  if (!env.GHL_API_KEY || !env.GHL_LOCATION_ID) return;
  const [firstName, ...rest] = lead.name.split(/\s+/);
  const headers = {
    Authorization: `Bearer ${env.GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const res = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
    method: "POST",
    headers,
    body: JSON.stringify({
      locationId: env.GHL_LOCATION_ID,
      firstName,
      lastName: rest.join(" "),
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      source: `website (${lead.channel})`,
      tags: ["kv-self-storage", `channel:${lead.channel}`, `reason:${lead.reason}`, "retell"],
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GHL contacts/upsert HTTP ${res.status}`);
  const body = (await res.json()) as { contact?: { id?: string } };
  const contactId = body.contact?.id;
  if (contactId && lead.notes) {
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: lead.notes }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => undefined);
  }
}
