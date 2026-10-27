import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { cardBrand, digitsOnly, parseExpiry, paymentTypeIdFor } from "@/lib/card";
import { env } from "@/lib/env";
import { HOLD_COOKIE, HoldError, payPassthrough, recordAutoBillEnabled } from "@/lib/holds";
import { verificationBody } from "@/lib/tenant-verification";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseConcessionId } from "@/lib/sitelink/concessions";
import { sitelink } from "@/lib/sitelink/client";

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
  let concessionId: number | null | undefined;
  if ("concessionId" in body) {
    const parsed = parseConcessionId(body.concessionId);
    if (!parsed.ok) return NextResponse.json({ error: "Choose a billing plan to continue." }, { status: 400, headers: noStore });
    concessionId = parsed.id;
  }
  try {
    const hold = await payPassthrough(
      id,
      { number: s("number"), cvv: s("cvv"), expiry: s("expiry"), name: s("name"), street: s("street"), postal: s("postal") },
      verificationBody(body),
      concessionId,
    );
    // Card stays in this request only. A failed auto-bill setup does not undo the move-in.
    try {
      if (hold.ledgerId && isLocationKey(hold.locationKey)) {
        const number = digitsOnly(s("number"));
        const expires = parseExpiry(s("expiry"));
        const types = await sitelink.paymentTypes(hold.locationKey);
        const typeId = expires ? paymentTypeIdFor(cardBrand(number), types) : null;
        if (expires && typeId) {
          await sitelink.enableAutoBillCard(hold.locationKey, {
            ledgerId: hold.ledgerId,
            cardTypeId: typeId,
            cardNumber: number,
            expires,
            name: s("name").trim(),
            street: s("street").trim(),
            postal: s("postal").trim(),
          });
          await recordAutoBillEnabled(hold.id);
        }
      }
    } catch (err) {
      log.warn("TenantBillingInfoUpdate_v2 failed; move-in kept", { holdId: id, err });
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    if (err instanceof HoldError) {
      const status = err.message === "verification" || err.message === "concession" ? 400 : 402;
      return NextResponse.json({ error: err.userMessage }, { status, headers: noStore });
    }
    log.error("pay route unexpected error", { holdId: id, name: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "We couldn't confirm your payment. Please call (902) 867-3779 before trying again so we can check it." }, { status: 500, headers: noStore });
  }
}
