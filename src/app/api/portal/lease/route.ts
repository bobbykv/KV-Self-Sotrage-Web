import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { getTenantSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { tenantOwnsLedger } from "@/lib/portal";
import { sitelink } from "@/lib/sitelink/client";

/** Creates a fresh SiteLink eSign lease URL on click (they are short-lived) and redirects to it. */
export async function GET(req: Request) {
  const session = await getTenantSession();
  const url = new URL(req.url);
  if (!session) return NextResponse.redirect(new URL("/portal/login", env.APP_URL));
  const loc = url.searchParams.get("location");
  const ledgerId = Number(url.searchParams.get("ledger"));
  const link = isLocationKey(loc) ? session.links.find((l) => l.locationKey === loc) : undefined;
  const fallback = new URL("/portal/lease-unavailable", env.APP_URL);
  if (!link || !ledgerId || !(await tenantOwnsLedger(link, ledgerId))) return NextResponse.redirect(fallback);
  const leaseUrl = await sitelink.leaseUrl(link.locationKey, link.tenantId, ledgerId, `${env.APP_URL}/portal`).catch(() => null);
  if (!leaseUrl) return NextResponse.redirect(fallback);
  return NextResponse.redirect(new URL(leaseUrl, env.APP_URL));
}
