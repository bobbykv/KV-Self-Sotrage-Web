import { NextResponse } from "next/server";
import { agentAuthorized } from "@/lib/agent-auth";
import { loadBrain, type AgentChannel } from "@/lib/brain";
import { env } from "@/lib/env";

/**
 * Shared agent brain for the Retell voice agent (and anything else that
 * should answer like the website chat). Retell: point your agent prompt /
 * knowledge sync at this URL and register the tools from `tools`.
 */
export async function GET(req: Request) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const channel = (["website_chat", "retell", "voice"].includes(url.searchParams.get("channel") ?? "") ? url.searchParams.get("channel") : "retell") as AgentChannel;
  const brain = await loadBrain(channel);
  return NextResponse.json({
    channel,
    prompt: brain.prompt,
    faqSource: brain.faqSource,
    tools: brain.tools.map((t) => ({ ...t, url: `${env.APP_URL}${t.http.path}` })),
  });
}
