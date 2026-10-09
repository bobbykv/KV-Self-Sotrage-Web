import { NextResponse } from "next/server";
import { agentAuthorized } from "@/lib/agent-auth";
import { loadBrain, parseAgentChannel } from "@/lib/brain";
import { env } from "@/lib/env";

/**
 * Shared agent brain for Retell (phone voice + website chat widget) and any
 * other runtime that should answer like the built-in website chat.
 * Point the agent prompt / knowledge sync at this URL and register the tools.
 * Use `?channel=website_chat` for the Retell chat agent, `?channel=retell` (default) for phone.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const channel = parseAgentChannel(url.searchParams.get("channel"), "retell");
  const brain = await loadBrain(channel);
  return NextResponse.json({
    channel,
    prompt: brain.prompt,
    faqSource: brain.faqSource,
    tools: brain.tools.map((t) => ({
      ...t,
      url: `${env.APP_URL}${t.http.path}?channel=${encodeURIComponent(channel)}`,
    })),
  });
}
