import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LOCATION_KEYS, isLocationKey, type LocationKey } from "@/config/locations";
import { captureLead, type LeadInput } from "./leads";
import { env } from "./env";
import { db } from "./db";

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

function customerText(session: Loose): string | undefined {
  const turns = Array.isArray(session.transcript_object) ? session.transcript_object : [];
  const structured = turns
    .map(asObj)
    .filter((turn) => turn.role === "user")
    .map((turn) => asStr(turn.content))
    .filter(Boolean)
    .join("\n");
  if (structured) return structured;
  const transcript = asStr(session.transcript);
  return transcript?.split("\n")
    .filter((line) => /^(?:user|caller|customer)\s*:/i.test(line.trim()))
    .join("\n");
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
  userText?: string;
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
  const dynamics = {
    ...asObj(sessionObj.retell_llm_dynamic_variables),
    ...asObj(sessionObj.collected_dynamic_variables),
  };
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
      userText: customerText(sessionObj),
      summary: asStr(analysis.chat_summary ?? analysis.call_summary),
      sentiment: asStr(analysis.user_sentiment),
      successful:
        typeof analysis.call_successful === "boolean"
          ? analysis.call_successful
          : typeof analysis.chat_successful === "boolean"
            ? (analysis.chat_successful as boolean)
            : undefined,
      custom: { ...dynamics, ...custom },
      // For outbound calls the customer is the recipient; the origin number
      // belongs to KV and must not become the GHL contact's phone.
      fromNumber: asStr(sessionObj.direction) === "outbound"
        ? asStr(sessionObj.to_number)
        : asStr(sessionObj.from_number),
      toNumber: asStr(sessionObj.to_number),
    },
  };
}

function retellSummaryNote(session: RetellSession): string {
  return [
    session.summary ? `Summary: ${session.summary}` : "Summary unavailable.",
    session.sentiment && `Sentiment: ${session.sentiment}`,
    `Retell ${session.kind}_id: ${session.id}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);
}

export function leadFromRetellSession(session: RetellSession): LeadInput | null {
  const custom = session.custom ?? {};
  // Only customer turns are searched for a contact number. Agent turns often
  // repeat KV's own phone number and must not become a visitor contact.
  const fromText = extractFromText(session.userText);
  const joinedName = [pickStr(custom, ["first_name", "firstName"]), pickStr(custom, ["last_name", "lastName"])].filter(Boolean).join(" ").trim();
  const name =
    pickStr(custom, ["name", "customer_name", "full_name", "contact_name"]) ??
    (joinedName || undefined) ??
    (session.kind === "chat" ? "Website chat visitor" : "Phone caller");
  const phone = pickStr(custom, ["phone", "phone_number", "mobile"]) ?? session.fromNumber ?? fromText.phone;
  const email = pickStr(custom, ["email", "email_address"]) ?? fromText.email;
  if (!phone && !email) return null;

  const locationKey = resolveLocation(pickStr(custom, ["location", "preferred_location", "location_key", "locationKey"]));
  const reasonRaw = pickStr(custom, ["reason", "lead_reason"]) ?? "contact_request";
  const reason = (["unavailable_unit", "waitlist", "contact_request", "human_handoff"].includes(reasonRaw) ? reasonRaw : "contact_request") as LeadInput["reason"];

  return {
    channel: session.channel,
    reason,
    name: name.slice(0, 120),
    phone,
    email,
    locationKey,
    unitType: pickStr(custom, ["unit_type", "unitType", "type"]),
    unitSize: pickStr(custom, ["unit_size", "unitSize", "size"]),
    notes: retellSummaryNote(session),
  };
}

export function shouldSyncRetellEvent(event: string): boolean {
  // Analysis contains the summary. Handling the preceding *_ended event too
  // would create two GHL notes/workflow deliveries for one conversation.
  return event === "chat_analyzed" || event === "call_analyzed";
}

/**
 * Save the contact locally, then deliver the contact and analysis summary to
 * GHL through the same API-first path used by website forms and agent tools.
 */
export async function syncRetellSessionToGhl(_event: string, session: RetellSession) {
  if (env.appTestMode) {
    return { ok: true as const, skipped: "APP_TEST_MODE" as const, leadId: null as string | null };
  }

  const externalId = `retell:${session.kind}:${session.id}`;
  const existing = await db.lead.findFirst({ where: { externalId } });
  const extracted = leadFromRetellSession(session);
  const leadInput = (extracted && existing
    ? {
        ...extracted,
        name: ["Website chat visitor", "Phone caller"].includes(extracted.name) ? existing.name : extracted.name,
        // Keep details captured by the tool ahead of regex guesses from text.
        phone: pickStr(session.custom ?? {}, ["phone", "phone_number", "mobile"])
          ?? session.fromNumber ?? existing.phone ?? extracted.phone,
        email: pickStr(session.custom ?? {}, ["email", "email_address"])
          ?? existing.email ?? extracted.email,
        locationKey: extracted.locationKey ?? (isLocationKey(existing.locationKey) ? existing.locationKey : undefined),
        unitType: extracted.unitType ?? existing.unitType ?? undefined,
        unitSize: extracted.unitSize ?? existing.unitSize ?? undefined,
        reason: extracted.reason === "contact_request" ? existing.reason as LeadInput["reason"] : extracted.reason,
      }
    : extracted) ??
    (existing && (existing.phone || existing.email)
      ? {
          channel: existing.channel as LeadInput["channel"],
          reason: existing.reason as LeadInput["reason"],
          name: existing.name,
          phone: existing.phone ?? undefined,
          email: existing.email ?? undefined,
          locationKey: isLocationKey(existing.locationKey) ? existing.locationKey : undefined,
          unitType: existing.unitType ?? undefined,
          unitSize: existing.unitSize ?? undefined,
          notes: retellSummaryNote(session),
        }
      : null);
  if (!leadInput) {
    return {
      ok: true,
      skipped: "No contact details",
      leadId: existing?.id ?? null,
      contact: false,
    };
  }

  if (existing?.ghlStatus === "sent" && existing.notes === leadInput.notes) {
    return { ok: true, leadId: existing.id, contact: true, deduped: true, ghlStatus: "sent" };
  }

  // Respond within Retell's 10-second webhook window. The lead's failed
  // status remains visible in /admin/leads and a non-2xx asks Retell to retry.
  const saved = await captureLead({ ...leadInput, externalId }, { notifyOnFailure: false });
  return {
    ok: saved.ghlStatus !== "failed",
    leadId: saved.id,
    contact: true,
    ghlStatus: saved.ghlStatus,
    ...(saved.ghlStatus === "skipped" ? { skipped: saved.ghlError ?? "GHL not configured" } : {}),
  };
}
