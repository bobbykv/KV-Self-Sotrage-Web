import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { expireHolds } from "@/lib/holds";
import { refreshInventory } from "@/lib/inventory";

export const maxDuration = 60;

/** Manual or scheduled refresh. Not registered in vercel.json (Hobby plan). Only snapshots that are due actually hit SiteLink. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const expired = await expireHolds();
  const results = await refreshInventory();
  const now = new Date();
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  return NextResponse.json({ ok: true, expiredHolds: expired, results: results ?? "locked (another refresh is running)" });
}
