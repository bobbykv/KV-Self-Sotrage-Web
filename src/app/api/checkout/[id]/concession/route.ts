import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getHold, HOLD_COOKIE, HoldError, quoteHold } from "@/lib/holds";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseConcessionId } from "@/lib/sitelink/concessions";
import type { MoveInCost } from "@/lib/sitelink/types";

export const runtime = "nodejs";

/** Requotes move-in cost when the customer picks a concession or standard 28-day billing. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  const { id } = await params;
  if ((await cookies()).get(HOLD_COOKIE)?.value !== id) {
    return NextResponse.json({ error: "Please use the device you started checkout on." }, { status: 403, headers: noStore });
  }
  if (!(await rateLimit(`concession:${await clientIp()}`, 20, 900))) {
    return NextResponse.json({ error: "Too many attempts. Please call (902) 867-3779." }, { status: 429, headers: noStore });
  }
  const hold = await getHold(id);
  if (!hold || hold.status !== "active") {
    return NextResponse.json({ error: "Your unit hold has ended. Check availability and start a new hold." }, { status: 400, headers: noStore });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }
  const parsed = parseConcessionId(body.concessionId);
  if (!parsed.ok) return NextResponse.json({ error: "Choose a billing plan to continue." }, { status: 400, headers: noStore });
  try {
    const updated = await quoteHold(hold, parsed.id);
    const cost = updated.costBreakdown as unknown as MoveInCost | null;
    return NextResponse.json({ ok: true, concessionId: updated.concessionId, total: cost?.total ?? null }, { headers: noStore });
  } catch (err) {
    if (err instanceof HoldError) return NextResponse.json({ error: err.userMessage }, { status: 400, headers: noStore });
    log.error("concession quote unexpected error", { holdId: id, name: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "We couldn't update your billing plan. Please try again or call (902) 867-3779." }, { status: 500, headers: noStore });
  }
}
