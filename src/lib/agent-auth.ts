import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Retell (and any other external agent runtime) authenticates with `Authorization: Bearer $AGENT_TOOL_SECRET`. */
export function agentAuthorized(req: Request): boolean {
  if (!env.AGENT_TOOL_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(env.AGENT_TOOL_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cronAuthorized(req: Request): boolean {
  if (!env.CRON_SECRET) return !env.isProd;
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}
