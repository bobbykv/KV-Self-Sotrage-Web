import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { HoldError } from "@/lib/holds";
import { rateLimit } from "@/lib/rate-limit";
import { parseConcessionId } from "@/lib/sitelink/concessions";
import { staffCheckoutLink, staffMoveIn, type StaffBookInput, type StaffCard } from "@/lib/staff-office";

export const runtime = "nodejs";

/**
 * Staff booking. The body can contain a card. Never log the request or the body.
 */
export async function POST(req: Request) {
  const noStore = { "Cache-Control": "no-store" };
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  if (!(await rateLimit(`admin-book:${admin.email}`, 30, 900))) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429, headers: noStore });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }

  const str = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
  const mode = body.mode === "movein" ? "movein" : body.mode === "hold" ? "hold" : null;
  const locationKey = str("locationKey");
  const unitId = Number(body.unitId);
  const moveInRaw = str("moveInDate");
  if (!mode || !isLocationKey(locationKey) || !Number.isInteger(unitId) || unitId <= 0) {
    return NextResponse.json({ error: "Choose a location and a vacant unit." }, { status: 400, headers: noStore });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveInRaw)) return NextResponse.json({ error: "Choose a move-in date." }, { status: 400, headers: noStore });
  const moveInDate = new Date(`${moveInRaw}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today.getTime() + 120 * 86_400_000);
  if (moveInDate < today || moveInDate > max) {
    return NextResponse.json({ error: "Choose a move-in date within the next 120 days." }, { status: 400, headers: noStore });
  }
  const email = str("email");
  const phone = str("phone");
  const firstName = str("firstName");
  const lastName = str("lastName");
  if (firstName.length < 1 || lastName.length < 1 || phone.length < 7 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the customer's name, email, and phone." }, { status: 400, headers: noStore });
  }
  const parsedConcession = parseConcessionId(body.concessionId ?? null);
  if (!parsedConcession.ok) return NextResponse.json({ error: "Choose a billing plan." }, { status: 400, headers: noStore });
  const payMethod = body.payMethod === "cash" || body.payMethod === "check" || body.payMethod === "card" ? body.payMethod : "card";

  const input: StaffBookInput = {
    mode,
    locationKey,
    unitId,
    firstName,
    lastName,
    email,
    phone,
    moveInDate,
    concessionId: parsedConcession.id,
    licenseNumber: str("licenseNumber"),
    licenseRegion: str("licenseRegion"),
    addr1: str("addr1"),
    city: str("city"),
    region: str("region"),
    postalCode: str("postalCode"),
    payMethod,
    checkNumber: str("checkNumber"),
    saveCard: body.saveCard === true,
    card: cardOf(body.card),
  };

  try {
    const result = mode === "hold" ? await staffCheckoutLink(input) : await staffMoveIn(input);
    await audit(admin.email, mode === "hold" ? "staff.hold" : "staff.move_in", `${locationKey}:${unitId}`, {
      holdId: result.holdId,
    });
    return NextResponse.json({ ok: true, mode, ...result }, { headers: noStore });
  } catch (err) {
    const message = err instanceof HoldError ? err.userMessage : "The booking did not complete. Check SiteLink before trying again.";
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
