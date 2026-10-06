import { NextResponse } from "next/server";
import { agentAuthorized } from "@/lib/agent-auth";
import { runTool, TOOL_NAMES, type ToolName } from "@/lib/chat/tools";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * HTTP versions of the shared agent tools, for Retell custom functions.
 * Accepts Retell's `{ name, args, call }` body or a bare args object.
 * Leads from here are tagged channel `retell`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!agentAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = await params;
  if (!TOOL_NAMES.includes(name as ToolName)) return NextResponse.json({ error: "unknown tool" }, { status: 404 });
  if (!(await rateLimit(`agent-tool:${await clientIp()}`, 120, 60))) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const args = (body.args && typeof body.args === "object" ? body.args : body) as Record<string, unknown>;
  return NextResponse.json(await runTool(name as ToolName, args, "retell"));
}
