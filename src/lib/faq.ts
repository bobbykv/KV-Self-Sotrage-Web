import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./db";

export type FaqEntry = { id: string; category: string; question: string; answer: string };
export type FaqCategory = { name: string; entries: FaqEntry[] };

const FAQ_SETTING_KEY = "faq_markdown";

export async function getFaqMarkdown(): Promise<{ markdown: string; source: "admin" | "file"; updatedAt: Date | null }> {
  const override = await db.setting.findUnique({ where: { key: FAQ_SETTING_KEY } }).catch(() => null);
  if (override && typeof (override.value as { markdown?: string }).markdown === "string") {
    return { markdown: (override.value as { markdown: string }).markdown, source: "admin", updatedAt: override.updatedAt };
  }
  return { markdown: await readFile(join(process.cwd(), "agent-brain/faq.md"), "utf8"), source: "file", updatedAt: null };
}

export async function saveFaqMarkdown(markdown: string) {
  parseFaq(markdown);
  await db.setting.upsert({ where: { key: FAQ_SETTING_KEY }, create: { key: FAQ_SETTING_KEY, value: { markdown } }, update: { value: { markdown } } });
}

export async function resetFaqToFile() {
  await db.setting.delete({ where: { key: FAQ_SETTING_KEY } }).catch(() => undefined);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, "");
}

export function parseFaq(markdown: string): FaqCategory[] {
  const cats: FaqCategory[] = [];
  let cat: FaqCategory | null = null;
  let entry: FaqEntry | null = null;
  for (const line of stripComments(markdown).split("\n")) {
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    if (h1) {
      cat = { name: h1[1].trim(), entries: [] };
      cats.push(cat);
      entry = null;
    } else if (h2) {
      if (!cat) {
        cat = { name: "General", entries: [] };
        cats.push(cat);
      }
      entry = { id: slug(h2[1]), category: cat.name, question: h2[1].trim(), answer: "" };
      cat.entries.push(entry);
    } else if (entry) {
      entry.answer += line + "\n";
    }
  }
  for (const c of cats) for (const e of c.entries) e.answer = e.answer.trim();
  if (!cats.some((c) => c.entries.length)) throw new Error("FAQ must contain at least one '## Question' entry");
  return cats.filter((c) => c.entries.length);
}

export async function getFaq(): Promise<FaqCategory[]> {
  return parseFaq((await getFaqMarkdown()).markdown);
}

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "i", "my", "you", "your", "to", "of", "and", "or", "can", "how", "what", "when", "where", "for", "in", "on", "at", "it", "be", "have", "with"]);
const SYNONYMS: Record<string, string[]> = {
  noke: ["nokey", "smart", "remote", "unlock", "app"],
  hours: ["open", "office", "time", "close", "closing"],
  access: ["gate", "code", "24", "night", "weekend"],
  pay: ["payment", "bill", "billing", "autopay", "card"],
  refund: ["refunds", "money", "back"],
  climate: ["heated", "temperature", "controlled"],
  parking: ["rv", "boat", "vehicle", "car", "trailer"],
  student: ["stfx", "university", "summer", "dorm"],
  maintenance: ["broken", "repair", "issue", "fix", "door", "light"],
  transfer: ["bigger", "smaller", "change", "switch", "upgrade"],
  "move-out": ["moving", "leave", "cancel", "vacate", "moveout"],
};

function tokens(s: string): string[] {
  const base = s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
  const out = new Set(base);
  for (const t of base) {
    for (const [k, syns] of Object.entries(SYNONYMS)) if (t === k || syns.includes(t)) [k, ...syns].forEach((x) => out.add(x));
  }
  return [...out];
}

export function searchFaq(cats: FaqCategory[], query: string, limit = 3): FaqEntry[] {
  const q = tokens(query);
  if (!q.length) return [];
  return cats
    .flatMap((c) => c.entries)
    .map((e) => {
      const qText = e.question.toLowerCase();
      const aText = e.answer.toLowerCase();
      const score = q.reduce((s, t) => s + (qText.includes(t) ? 3 : 0) + (aText.includes(t) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
