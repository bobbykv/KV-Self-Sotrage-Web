import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/agent-auth";
import { refreshInventory, refreshReports } from "@/lib/inventory";

export const maxDuration = 120;

/**
 * Full inventory re-pull with the lngLastTimePolled cursor reset — SiteLink's
 * recommended daily cache clear — plus the Reporting API dashboard job.
 * Not scheduled (Vercel crons are off on the Hobby plan); staff can run the
 * same work from the dashboard. Never runs on the public request path.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const inventory = await refreshInventory({ full: true });
  const reports = await refreshReports();
  return NextResponse.json({ ok: true, inventory, reports });
}
