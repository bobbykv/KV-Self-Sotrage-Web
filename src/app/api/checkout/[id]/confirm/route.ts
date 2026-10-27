import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { confirmPaySeparately, HOLD_COOKIE, HoldError } from "@/lib/holds";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verificationBody } from "@/lib/tenant-verification";

export const runtime = "nodejs";

/** PAYMENT_MODE=pay_separately. ID photo rides in this JSON body, never a server action. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  if (env.PAYMENT_MODE === "passthrough") {
    return NextResponse.json({ error: "Use the card form to finish this rental." }, { status: 404, headers: noStore });
  }
  const { id } = await params;
  if ((await cookies()).get(HOLD_COOKIE)?.value !== id) {
    return NextResponse.json({ error: "Please use the device you started checkout on." }, { status: 403, headers: noStore });
  }
  if (!(await rateLimit(`confirm:${await clientIp()}`, 8, 900))) {
    return NextResponse.json({ error: "Too many attempts. Please call (902) 867-3779." }, { status: 429, headers: noStore });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }

  try {
    await confirmPaySeparately(id, verificationBody(body));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    if (err instanceof HoldError) return NextResponse.json({ error: err.userMessage }, { status: 400, headers: noStore });
    log.error("confirm route unexpected error", { holdId: id, name: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "We couldn't confirm your reservation. Try again or call (902) 867-3779." }, { status: 500, headers: noStore });
  }
}
