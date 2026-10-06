import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/agent-auth";
import { refreshInventory, refreshReports } from "@/lib/inventory";

export const maxDuration = 120;

/**
 * Nightly (after hours): full inventory re-pull with the lngLastTimePolled
 * cursor reset — SiteLink's recommended daily cache clear — plus the
 * Reporting API dashboard job. Never runs on the public request path.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const inventory = await refreshInventory({ full: true });
  const reports = await refreshReports();
  return NextResponse.json({ ok: true, inventory, reports });
}
