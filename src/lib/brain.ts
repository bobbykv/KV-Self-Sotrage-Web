import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOCATIONS, formatHours, fullAddress } from "@/config/locations";
import { getFaqMarkdown, stripComments } from "./faq";

export type AgentChannel = "website_chat" | "retell" | "voice";

export type ToolDef = {
  name: string;
  description: string;
  http: { method: string; path: string };
  parameters: Record<string, unknown>;
};

function locationsBlock(): string {
  return LOCATIONS.map((l) => {
    const a = l.amenities;
    const features = [
      a.climateControlled === true && "climate-controlled units",
      a.climateControlled === false && "no climate-controlled units",
      a.vehicleParking === true && "RV/boat/vehicle parking",
      a.nokeRemoteUnlock ? "Noke smart-lock remote unlock" : "standard access code (no Noke)",
      `${l.access} access`,
    ].filter(Boolean);
    const hours = l.officeHours.map((h) => `${h.days} ${formatHours(h)}`).join("; ");
    return `- **${l.name}** (key \`${l.key}\`) — ${fullAddress(l)}${l.landmark ? ` (${l.landmark})` : ""}. Office ${hours}. ${features.join(", ")}.`;
  }).join("\n");
}

/** The single prompt both the website chat and Retell use. */
export async function loadBrain(channel: AgentChannel) {
  const [template, toolsRaw, faq] = await Promise.all([
    readFile(join(process.cwd(), "agent-brain/brain.md"), "utf8"),
    readFile(join(process.cwd(), "agent-brain/tools.json"), "utf8"),
    getFaqMarkdown(),
  ]);
  const prompt = stripComments(template)
    .replace("{{LOCATIONS}}", locationsBlock())
    .replace("{{CHANNEL}}", channel)
    .replace("{{FAQ}}", stripComments(faq.markdown).trim())
    .trim();
  const tools = (JSON.parse(toolsRaw) as { tools: ToolDef[] }).tools;
  return { prompt, tools, faqSource: faq.source };
}
