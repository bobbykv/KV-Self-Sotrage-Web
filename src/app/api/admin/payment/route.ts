import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { HoldError } from "@/lib/holds";
import { rateLimit } from "@/lib/rate-limit";
import { takeStaffPayment, updateStaffBilling, type StaffCard } from "@/lib/staff-office";

export const runtime = "nodejs";

/**
 * Staff ledger payment and card-on-file update. The body can contain a card.
 * Never log the request or the body.
 */
export async function POST(req: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  if (!(await rateLimit(`admin-pay:${admin.email}`, 40, 900))) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429, headers: noStore });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }

  const str = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
  const locationKey = str("locationKey");
  const tenantId = Number(body.tenantId);
  const unitId = Number(body.unitId);
  const ledgerId = Number(body.ledgerId);
  if (!isLocationKey(locationKey) || !Number.isInteger(ledgerId) || ledgerId <= 0) {
    return NextResponse.json({ error: "That ledger could not be found." }, { status: 400, headers: noStore });
  }

  try {
    if (body.action === "billing") {
      const result = await updateStaffBilling({
        locationKey,
        ledgerId,
        autoBill: body.autoBill === true,
        card: cardOf(body.card),
      });
      await audit(admin.email, "tenant.billing", `${locationKey}:${tenantId}`, { ledgerId, autoBill: result.autoBill });
      return NextResponse.json({ ok: true, ...result }, { headers: noStore });
    }

    if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(unitId) || unitId <= 0) {
      return NextResponse.json({ error: "That ledger could not be found." }, { status: 400, headers: noStore });
    }
    const method = body.method === "cash" || body.method === "check" || body.method === "card" ? body.method : null;
    const amount = Number(body.amount);
    if (!method) return NextResponse.json({ error: "Choose card, cash, or check." }, { status: 400, headers: noStore });
    const result = await takeStaffPayment({
      locationKey,
      tenantId,
      unitId,
      ledgerId,
      unitName: str("unitName") || String(unitId),
      method,
      amount,
      checkNumber: str("checkNumber"),
      saveCard: body.saveCard === true,
      card: cardOf(body.card),
    });
    await audit(admin.email, "tenant.payment", `${locationKey}:${tenantId}`, {
      ledgerId,
      method,
      amount,
      receiptId: result.receiptId,
      autoBillEnabled: result.autoBillEnabled,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (err) {
    const message = err instanceof HoldError ? err.userMessage : "SiteLink did not complete that update.";
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}

function cardOf(value: unknown): StaffCard | undefined {
  if (!value || typeof value !== "object") return undefined;
  const card = value as Record<string, unknown>;
  const s = (key: string) => (typeof card[key] === "string" ? card[key] : "");
  if (!s("number") && !s("expiry") && !s("cvv")) return undefined;
  return { number: s("number"), cvv: s("cvv"), expiry: s("expiry"), name: s("name"), street: s("street"), postal: s("postal") };
}
