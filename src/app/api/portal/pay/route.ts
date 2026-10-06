import { NextResponse } from "next/server";
import { isLocationKey } from "@/config/locations";
import { getTenantSession } from "@/lib/auth";
import { cardBrand, digitsOnly, luhnValid, parseExpiry } from "@/lib/card";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeErrorMessage } from "@/lib/log";
import { tenantOwnsLedger } from "@/lib/portal";
import { sitelink } from "@/lib/sitelink/client";
import { SIM_CARD_APPROVE, SIM_CARD_DECLINE } from "@/lib/sitelink/mock";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (env.PAYMENT_MODE !== "passthrough") {
    return NextResponse.json({ error: "Online balance payment isn't enabled. Call (902) 867-3779." }, { status: 400 });
  }
  const session = await getTenantSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const locationKey = String((body as { locationKey?: string }).locationKey ?? "");
  const ledgerId = Number((body as { ledgerId?: number }).ledgerId);
  if (!isLocationKey(locationKey) || !ledgerId) return NextResponse.json({ error: "Choose a unit." }, { status: 400 });

  const link = session.links.find((l) => l.locationKey === locationKey);
  if (!link) return NextResponse.json({ error: "That location isn't on your account." }, { status: 403 });

  const ledger = await tenantOwnsLedger(link, ledgerId);
  if (!ledger) return NextResponse.json({ error: "We couldn't find that unit." }, { status: 404 });

  const amount = Number(ledger.balance);
  if (!(amount > 0)) return NextResponse.json({ error: "There's no balance due on this unit." }, { status: 400 });

  const number = digitsOnly(String((body as { number?: string }).number ?? ""));
  const expires = parseExpiry(String((body as { expiry?: string }).expiry ?? ""));
  const cvv = digitsOnly(String((body as { cvv?: string }).cvv ?? ""));
  const name = String((body as { name?: string }).name ?? "").trim();
  const street = String((body as { street?: string }).street ?? "").trim();
  const postal = String((body as { postal?: string }).postal ?? "").trim();

  if (!luhnValid(number)) return NextResponse.json({ error: "That card number doesn't look right." }, { status: 400 });
  if (!expires) return NextResponse.json({ error: "Please check the expiry date (MM/YY)." }, { status: 400 });
  if (cvv.length < 3 || cvv.length > 4) return NextResponse.json({ error: "Please check the security code." }, { status: 400 });
  if (!name || !street || !postal) return NextResponse.json({ error: "Please fill in billing details." }, { status: 400 });

  // Simulator: approve / decline known test cards.
  if (env.sitelinkMode === "mock" || env.appTestMode) {
    if (number === digitsOnly(SIM_CARD_DECLINE)) {
      return NextResponse.json({ error: "Card declined. Try another card or call (902) 867-3779." }, { status: 402 });
    }
    if (number !== digitsOnly(SIM_CARD_APPROVE) && !luhnValid(number)) {
      return NextResponse.json({ error: "That card number doesn't look right." }, { status: 400 });
    }
  } else {
    // Live passthrough without a SiteLink pay-balance method yet.
    void cardBrand(number);
    return NextResponse.json({ error: "Balance payments aren't available online yet. Call (902) 867-3779." }, { status: 400 });
  }

  try {
    await sitelink.clearLedgerBalance(locationKey, ledgerId, amount);
    const ref = `PB${Date.now().toString(36).toUpperCase()}`;
    await db.paymentReceipt.create({
      data: {
        locationKey,
        tenantId: link.tenantId,
        ledgerId,
        amount,
        paymentRef: ref,
        description: `Portal balance payment · unit ${ledger.unitName}`,
        periodLabel: "Balance payment",
      },
    });
    return NextResponse.json({ ok: true, ref });
  } catch (err) {
    return NextResponse.json({ error: safeErrorMessage(err, 120) || "Payment failed." }, { status: 500 });
  }
}
