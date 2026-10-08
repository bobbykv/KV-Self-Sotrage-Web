import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { HOLD_COOKIE, HoldError, payPassthrough } from "@/lib/holds";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * PCI-sensitive route (PAYMENT_MODE=passthrough). The request body contains
 * raw card data: never log `req`, the body, or `card`; never forward to error
 * tracking; never persist. Errors are reduced to HoldError.userMessage.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };
  if (env.PAYMENT_MODE !== "passthrough") return NextResponse.json({ error: "Online card payment isn't enabled." }, { status: 404, headers: noStore });
  const { id } = await params;
  if ((await cookies()).get(HOLD_COOKIE)?.value !== id) return NextResponse.json({ error: "Please use the device you started checkout on." }, { status: 403, headers: noStore });
  if (!(await rateLimit(`pay:${await clientIp()}`, 8, 900))) return NextResponse.json({ error: "Too many attempts. Please call (902) 867-3779." }, { status: 429, headers: noStore });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  try {
    await payPassthrough(id, { number: s("number"), cvv: s("cvv"), expiry: s("expiry"), name: s("name"), street: s("street"), postal: s("postal") });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    if (err instanceof HoldError) return NextResponse.json({ error: err.userMessage }, { status: 402, headers: noStore });
    log.error("pay route unexpected error", { holdId: id, name: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "We couldn't confirm your payment. Please call (902) 867-3779 before trying again so we can check it." }, { status: 500, headers: noStore });
  }
}
