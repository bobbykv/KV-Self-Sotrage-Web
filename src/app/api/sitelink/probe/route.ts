import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/agent-auth";
import { env } from "@/lib/env";
import { automaticRefreshIsPaused, refreshInventory } from "@/lib/inventory";
import { collectSoapDiagnostics } from "@/lib/sitelink/diagnostics";
import { parseProbeRequest } from "@/lib/sitelink/refresh-policy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One SiteLink call for one location. Awaited in this request.
 * Runs even while automatic refreshes are paused. Requires the cron secret
 * in production. Does not echo credentials.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = parseProbeRequest(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const paused = await automaticRefreshIsPaused();
  const { value, diagnostics } = await collectSoapDiagnostics(() =>
    refreshInventory({
      force: true,
      full: true,
      locations: [parsed.location],
      kinds: [parsed.kind],
      probe: true,
    }),
  );

  if (value === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "Another SiteLink refresh is already running. This probe did not start a second call.",
        location: parsed.location,
        kind: parsed.kind,
        automaticRefreshPaused: paused,
        diagnostics,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: value.every((row) => row.ok),
    location: parsed.location,
    locationCode: env.sitelinkLocationCodes[parsed.location] ?? null,
    kind: parsed.kind,
    mode: env.sitelinkMode,
    automaticRefreshPaused: paused,
    results: value,
    diagnostics,
  });
}
