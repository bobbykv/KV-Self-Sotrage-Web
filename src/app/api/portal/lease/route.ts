import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { getTenantSession } from "@/lib/auth";
import { tenantOwnsLedger } from "@/lib/portal";
import { publicUrl } from "@/lib/site-url";
import { sitelink } from "@/lib/sitelink/client";

/** Creates a fresh SiteLink eSign lease URL on click (they are short-lived) and redirects to it. */
export async function GET(req: Request) {
  const session = await getTenantSession();
  const url = new URL(req.url);
  if (!session) return NextResponse.redirect(await publicUrl("/portal/login"));
  const loc = url.searchParams.get("location");
  const ledgerId = Number(url.searchParams.get("ledger"));
  const link = isLocationKey(loc) ? session.links.find((l) => l.locationKey === loc) : undefined;
  const fallback = await publicUrl("/portal/lease-unavailable");
  if (!link || !ledgerId || !(await tenantOwnsLedger(link, ledgerId))) {
    return NextResponse.redirect(fallback);
  }
  const returnTo = await publicUrl("/portal");
  const leaseUrl = await sitelink.leaseUrl(link.locationKey, link.tenantId, ledgerId, returnTo).catch(() => null);
  if (!leaseUrl) return NextResponse.redirect(fallback);
  // Absolute eSign URLs pass through; relative mock paths are resolved against the public origin.
  const target = /^https?:\/\//i.test(leaseUrl) ? leaseUrl : await publicUrl(leaseUrl);
  if (/localhost|127\.0\.0\.1/i.test(target)) return NextResponse.redirect(fallback);
  return NextResponse.redirect(target);
}
