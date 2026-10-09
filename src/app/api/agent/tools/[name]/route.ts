import { NextResponse } from "next/server";
import { agentAuthorized } from "@/lib/agent-auth";
import { parseAgentChannel } from "@/lib/brain";
import { runTool, TOOL_NAMES, type ToolName } from "@/lib/chat/tools";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * HTTP versions of the shared agent tools, for Retell custom functions.
 * Accepts Retell's `{ name, args, call }` body or a bare args object.
 * Channel comes from `?channel=` (set by /api/agent/brain tool URLs):
 * `website_chat` for the Retell web chat agent, `retell` (default) for phone.
 */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = await params;
  if (!TOOL_NAMES.includes(name as ToolName)) return NextResponse.json({ error: "unknown tool" }, { status: 404 });
  if (!(await rateLimit(`agent-tool:${await clientIp()}`, 120, 60))) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  const channel = parseAgentChannel(new URL(req.url).searchParams.get("channel"), "retell");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const args = (body.args && typeof body.args === "object" ? body.args : body) as Record<string, unknown>;
  // Retell sends `{ name, args, call|chat }`; stamp externalId so webhook + tool don't double-create.
  const call = (body.call && typeof body.call === "object" ? body.call : null) as Record<string, unknown> | null;
  const chat = (body.chat && typeof body.chat === "object" ? body.chat : null) as Record<string, unknown> | null;
  const retellId = typeof chat?.chat_id === "string" ? chat.chat_id : typeof call?.call_id === "string" ? call.call_id : undefined;
  if (retellId && name === "capture_lead" && !args.external_id) {
    args.external_id = `${channel === "website_chat" ? "retell:chat" : "retell:call"}:${retellId}`;
  }
  return NextResponse.json(await runTool(name as ToolName, args, channel));
}
