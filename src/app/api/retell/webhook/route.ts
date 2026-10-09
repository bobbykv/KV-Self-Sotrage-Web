import { NextResponse } from "next/server";
import { agentAuthorized } from "@/lib/agent-auth";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  parseRetellWebhook,
  shouldSyncRetellEvent,
  syncRetellSessionToGhl,
  verifyRetellSignature,
} from "@/lib/retell-webhook";

/**
 * Retell agent webhook → GoHighLevel.
 * Point the Retell chat/voice agent webhook URL here so analyzed
 * conversations can update a contact and summary note in GHL.
 *
 * Auth: X-Retell-Signature verified with RETELL_API_KEY (the key with the
 * webhook badge in Retell). Falls back to Bearer AGENT_TOOL_SECRET for
 * manual tests when no Retell signature is present.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`retell-webhook:${await clientIp()}`, 120, 60))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature") ?? "";

  let authorized = false;
  if (env.RETELL_API_KEY && signature) {
    authorized = verifyRetellSignature(rawBody, env.RETELL_API_KEY, signature);
  } else if (!signature && agentAuthorized(req)) {
    authorized = true;
  }
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, session } = parseRetellWebhook(body);
  if (!shouldSyncRetellEvent(event) || !session) {
    return NextResponse.json({ ok: true, ignored: event || "unknown" });
  }

  try {
    const result = await syncRetellSessionToGhl(event, session);
    return NextResponse.json({ event, ...result }, { status: result.ok === false ? 502 : 200 });
  } catch (err) {
    log.warn("Retell webhook sync failed", { event, sessionId: session.id, err });
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
