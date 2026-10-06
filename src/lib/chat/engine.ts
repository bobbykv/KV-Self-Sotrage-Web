import "server-only";
import { BRAND, LOCATIONS, type LocationKey } from "@/config/locations";
import { env } from "../env";
import { loadBrain } from "../brain";
import { log } from "../log";
import { money } from "../catalog";
import { searchUnits, getFaqAnswer, runTool, TOOL_NAMES, type ToolName } from "./tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatAction =
  | { type: "lead_form"; reason: "unavailable_unit" | "waitlist" | "contact_request" | "human_handoff"; locationKey?: LocationKey; unitType?: string; unitSize?: string }
  | { type: "call" }
  | { type: "link"; href: string; label: string };
export type ChatReply = { reply: string; actions: ChatAction[]; handoff?: boolean };

const PAN_RE = /\b(?:\d[ -]?){12,19}\b/;
const CARD_REPLY: ChatReply = {
  reply:
    "Please don't share card details in chat. To arrange payment, follow your checkout instructions, use your account's payment link, or call the office.",
  actions: [{ type: "call" }],
};

export function containsCardNumber(text: string) {
  return PAN_RE.test(text);
}

/** Drops anything that looks like a card number from history before it can reach a model. */
function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-12).map((m) => ({ role: m.role, content: m.content.replace(/\b(?:\d[ -]?){12,19}\b/g, "[removed]").slice(0, 800) }));
}

export async function chat(history: ChatMessage[]): Promise<ChatReply> {
  const last = history[history.length - 1];
  if (!last || last.role !== "user") return greeting();
  if (containsCardNumber(last.content)) return CARD_REPLY;
  const clean = sanitizeHistory(history);
  if (env.CHAT_LLM_API_KEY) {
    try {
      return await llmChat(clean);
    } catch (err) {
      log.warn("chat LLM failed; using rules fallback", { err });
    }
  }
  return rulesChat(clean[clean.length - 1].content);
}

export function greeting(): ChatReply {
  return {
    reply: "Need help with a size, price or location? Ask here. You can also call (902) 867-3779.",
    actions: [
      { type: "link", href: "/units", label: "See units & prices" },
      { type: "link", href: "/size-finder", label: "Help me choose a size" },
    ],
  };
}

// ---------- LLM path (OpenAI-compatible chat completions, tight tool allowlist) ----------

type OAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function llmChat(history: ChatMessage[]): Promise<ChatReply> {
  const brain = await loadBrain("website_chat");
  const tools = brain.tools
    .filter((t) => TOOL_NAMES.includes(t.name as ToolName))
    .map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: OAIMessage[] = [{ role: "system", content: brain.prompt }, ...history];
  const actions: ChatAction[] = [];
  let handoff = false;

  for (let step = 0; step < 4; step++) {
    const res = await fetch(`${env.CHAT_LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CHAT_LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.CHAT_LLM_MODEL, messages, tools, temperature: 0.2, max_tokens: 400 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as { choices: { message: Extract<OAIMessage, { role: "assistant" }> }[] };
    const msg = data.choices[0].message;
    if (!msg.tool_calls?.length) {
      return { reply: (msg.content ?? "").trim() || "Sorry, could you say that another way?", actions: dedupe(actions), handoff };
    }
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      const name = call.function.name as ToolName;
      let result: unknown;
      if (!TOOL_NAMES.includes(name)) result = { error: "tool not allowed" };
      else {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* empty args */
        }
        result = await runTool(name, args, "website_chat");
        if (name === "handoff_to_human") {
          handoff = true;
          actions.push({ type: "call" }, { type: "lead_form", reason: "human_handoff" });
        }
        if (name === "search_units") {
          const r = result as Awaited<ReturnType<typeof searchUnits>>;
          r.available.slice(0, 3).forEach((u) => actions.push({ type: "link", href: u.hold_url, label: `View ${u.size} at ${u.location_name}` }));
        }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
    }
  }
  return { reply: `Let me get a person to help. You can call us at ${BRAND.phone}.`, actions: [{ type: "call" }], handoff: true };
}

function dedupe(actions: ChatAction[]): ChatAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    const k = JSON.stringify(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- Deterministic fallback (no LLM key, or LLM outage) ----------

const LOC_PATTERNS: [LocationKey, RegExp][] = [
  ["haley", /haley|downtown|in town|antigonish town/i],
  ["hwy4", /hwy ?4|highway ?4|addington|exit ?31|lower west river|salt springs|2784/i],
  ["stellarton", /stellarton|new glasgow|westville|trenton|pictou|heritage/i],
];

/** Towns served by more than one site: narrow results without picking a single location. */
const AREA_PATTERNS: [string, RegExp, LocationKey[]][] = [["Antigonish", /antigonish|stfx/i, ["haley", "hwy4"]]];

export function parseUnitIntent(text: string) {
  const location = LOC_PATTERNS.find(([, re]) => re.test(text))?.[0];
  const size = text.match(/(\d{1,2})\s*(?:x|by|×)\s*(\d{1,2})/i);
  let size_category: string | undefined;
  if (/\b(rv|boat|trailer|vehicle|car|parking|camper)\b/i.test(text)) size_category = "parking";
  else if (/\bsmall|locker|dorm|few boxes|5\s*x\s*5\b/i.test(text)) size_category = "small";
  else if (/\bmedium|apartment|1 bed|one bed|2 bed|two bed/i.test(text)) size_category = "medium";
  else if (/\blarge|house|3 bed|three bed|business|workshop/i.test(text)) size_category = "large";
  if (size && !size_category) {
    const area = Number(size[1]) * Number(size[2]);
    size_category = area <= 50 ? "small" : area <= 150 ? "medium" : "large";
  }
  const climate = /climate|heated|temperature/i.test(text) || undefined;
  const wantsUnits = Boolean(location || size_category || climate || /\b(unit|units|available|availability|price|prices|cost|rent|storage|space|open)\b/i.test(text));
  return { location, size_category, climate_controlled: climate, wantsUnits, sizeText: size ? `${size[1]}x${size[2]}` : undefined };
}

export async function rulesChat(text: string): Promise<ChatReply> {
  if (/\b(human|person|someone|agent|staff|call me|speak|talk to)\b/i.test(text) || /refund|complain|dispute|manager/i.test(text)) {
    const refund = /refund/i.test(text);
    return {
      reply: `${refund ? "Refund requests need a personal review. You can contact the team or request a callback. " : ""}You can reach the KV team at ${BRAND.phone} (Mon–Fri office hours, or leave a message), or leave your details and we'll call you back.`,
      actions: [{ type: "call" }, { type: "lead_form", reason: "human_handoff" }],
      handoff: true,
    };
  }

  const intent = parseUnitIntent(text);
  const faq = await getFaqAnswer({ query: text });
  const isQuestionFirst = faq.results.length > 0 && !/\b(available|availability|price|prices|cost|units?)\b/i.test(text) && !intent.sizeText;

  if (intent.wantsUnits && !isQuestionFirst) {
    const r = await searchUnits(intent);
    const area = !intent.location ? AREA_PATTERNS.find(([, re]) => re.test(text)) : undefined;
    const available = r.available
      .filter((u) => !area || area[2].includes(u.location as LocationKey))
      .sort((a, b) => Number(b.size === intent.sizeText) - Number(a.size === intent.sizeText));
    const where = intent.location ? LOCATIONS.find((l) => l.key === intent.location)!.shortName : area ? `our ${area[0]} locations` : "our locations";
    if (available.length) {
      const lines = available.slice(0, 4).map((u) => `• ${u.size_label} ${u.type} at ${u.location_name}: ${money(u.monthly_price)}/month + HST (${u.available_count} listed)`);
      return {
        reply: `Here are some spaces to compare at ${where}:\n${lines.join("\n")}\n\nChoose one to review the details and your move-in total. Starting checkout holds the space for the time shown there.${r.as_of ? ` (Updated ${timeAgo(r.as_of)}.)` : ""}`,
        actions: available.slice(0, 3).map((u) => ({ type: "link" as const, href: u.hold_url, label: `View ${u.size} · ${u.location_name}` })),
      };
    }
    return {
      reply: `No spaces match that request at ${where} at the moment. Compare another size or location, or leave your details for the free waitlist. We'll contact you when a suitable space opens.`,
      actions: [
        { type: "lead_form", reason: "unavailable_unit", locationKey: intent.location, unitSize: intent.sizeText, unitType: intent.size_category },
        { type: "link", href: "/units", label: "See everything that's open" },
      ],
    };
  }

  if (faq.results.length) {
    const top = faq.results[0];
    return {
      reply: top.answer.replace(/\*\*/g, ""),
      actions: [{ type: "link", href: top.url, label: "More in our FAQ" }],
    };
  }

  return {
    reply: `I'm not sure about that. I can help you compare sizes and prices, answer questions about access or your rental, or request a callback from the KV team.`,
    actions: [
      { type: "link", href: "/units", label: "See available units" },
      { type: "link", href: "/faq", label: "Browse the FAQ" },
      { type: "lead_form", reason: "contact_request" },
    ],
  };
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 90) return `${mins} minutes ago`;
  return `${Math.round(mins / 60)} hours ago`;
}
