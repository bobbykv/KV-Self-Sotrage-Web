import "server-only";
import { randomBytes } from "node:crypto";
import type { LocationKey } from "@/config/locations";
import { cardBrand, digitsOnly, luhnValid, parseExpiry, paymentTypeIdFor } from "./card";
import { db } from "./db";
import { env } from "./env";
import { getDiscountToggles } from "./discount-visibility";
import { chooseHoldConcession, createHold, HoldError, isSiteLinkPermissionDenied } from "./holds";
import { getInventory } from "./inventory";
import { log, safeErrorMessage } from "./log";
import { isRegionCode } from "./regions";
import { sitelink, SiteLinkError } from "./sitelink/client";
import { PAY_METHOD_CASH, PAY_METHOD_CHECK, PAY_METHOD_CREDIT_CARD } from "./sitelink/enums";
import type { Unit } from "./sitelink/types";

const STAFF_HOLD_MS = 72 * 60 * 60 * 1000;
const DUMMY_CARD_EXPIRY = new Date("2099-12-31T00:00:00Z");

export type StaffCard = {
  number: string;
  cvv: string;
  expiry: string;
  name: string;
  street: string;
  postal: string;
};

export type StaffBookInput = {
  mode: "hold" | "movein";
  locationKey: LocationKey;
  unitId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  moveInDate: Date;
  /** null is standard 28-day billing. A number must be a plan currently shown on the website. */
  concessionId: number | null;
  licenseNumber?: string;
  licenseRegion?: string;
  addr1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  payMethod?: "card" | "cash" | "check";
  checkNumber?: string;
  saveCard?: boolean;
  card?: StaffCard;
};

export type StaffPayInput = {
  locationKey: LocationKey;
  tenantId: number;
  unitId: number;
  ledgerId: number;
  unitName: string;
  method: "card" | "cash" | "check";
  amount: number;
  checkNumber?: string;
  saveCard?: boolean;
  card?: StaffCard;
};

function text(value: string | undefined) {
  return (value ?? "").trim();
}

function permissionMessage() {
  return "SiteLink has not enabled this API user yet (code -95). This action is unavailable until that is turned on.";
}

function asHoldError(err: unknown, fallback: string): HoldError {
  if (err instanceof HoldError) return err;
  if (isSiteLinkPermissionDenied(err)) return new HoldError("sitelink-95", permissionMessage());
  if (err instanceof SiteLinkError) return new HoldError(safeErrorMessage(err.message), fallback);
  return new HoldError(safeErrorMessage(err), fallback);
}

async function vacantUnit(locationKey: LocationKey, unitId: number, live: boolean): Promise<Unit> {
  const inventory = await getInventory();
  const cached = inventory.find((l) => l.location === locationKey)?.units.find((u) => u.unitId === unitId);
  if (!live) {
    if (!cached) throw new HoldError("unit", "That unit is not in the website cache. Refresh units, then try again.");
    if (cached.rented || !cached.rentable) throw new HoldError("unit", "That unit is not vacant.");
    return cached;
  }
  let unit: Unit | null;
  try {
    unit = await sitelink.unitById(locationKey, unitId);
  } catch (err) {
    throw asHoldError(err, "We couldn't confirm that unit with SiteLink. Please try again.");
  }
  if (!unit || unit.rented || !unit.rentable) {
    throw new HoldError("unit", "That unit is not vacant in SiteLink.");
  }
  return unit;
}

function parsedCard(card: StaffCard | undefined) {
  if (!card) throw new HoldError("card", "Enter the card number, expiry, security code, and billing address.");
  const number = digitsOnly(card.number);
  const cvv = digitsOnly(card.cvv);
  const expires = parseExpiry(card.expiry);
  if (!luhnValid(number)) throw new HoldError("card", "That card number doesn't look right.");
  if (!expires) throw new HoldError("card", "Please check the expiry date (MM/YY).");
  if (cvv.length < 3 || cvv.length > 4) throw new HoldError("card", "Please check the security code.");
  if (!card.name.trim() || !card.street.trim() || !card.postal.trim()) {
    throw new HoldError("card", "Please fill in the billing name, street, and postal code.");
  }
  return { number, cvv, expires, name: card.name.trim(), street: card.street.trim(), postal: card.postal.trim() };
}

async function cardTypeId(loc: LocationKey, number: string) {
  const types = await sitelink.paymentTypes(loc);
  const typeId = paymentTypeIdFor(cardBrand(number), types);
  if (!typeId) throw new HoldError("card", "We can't accept that card type. Use Visa or Mastercard, or take cash or a check.");
  return typeId;
}

function leaseIdentity(input: StaffBookInput) {
  const licenseNumber = text(input.licenseNumber).replace(/\s+/g, " ");
  const licenseRegion = text(input.licenseRegion).toUpperCase();
  const addr1 = text(input.addr1).replace(/\s+/g, " ");
  const city = text(input.city).replace(/\s+/g, " ");
  const region = text(input.region).toUpperCase();
  const postalCode = text(input.postalCode).toUpperCase().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,28}[A-Za-z0-9]$/.test(licenseNumber)) {
    throw new HoldError("license", "Enter the driver's licence number.");
  }
  if (!isRegionCode(licenseRegion)) throw new HoldError("license", "Choose the province or state that issued the licence.");
  if (addr1.length < 2 || addr1.length > 80) throw new HoldError("address", "Enter the street address.");
  if (city.length < 2 || city.length > 60) throw new HoldError("address", "Enter the city.");
  if (!isRegionCode(region)) throw new HoldError("address", "Choose the mailing province or state.");
  if (!/^[A-Z0-9][A-Z0-9 -]{1,10}[A-Z0-9]$/.test(postalCode)) throw new HoldError("address", "Enter the postal code.");
  return { licenseNumber, licenseRegion, addr1, city, region, postalCode };
}

/** Checkout link the customer opens on their own phone. Does not take payment. */
export async function staffCheckoutLink(input: StaffBookInput) {
  const hold = await createHold({
    locationKey: input.locationKey,
    unitId: input.unitId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    moveInDate: input.moveInDate,
    concessionId: input.concessionId,
    staffIssued: true,
    holdMs: STAFF_HOLD_MS,
  });
  if (!hold.claimToken) throw new HoldError("claim", "The checkout link could not be created. Please try again.");
  const checkoutUrl = `${env.APP_URL}/checkout/${hold.id}/open?k=${encodeURIComponent(hold.claimToken)}`;
  return { holdId: hold.id, checkoutUrl, expiresAt: hold.expiresAt.toISOString() };
}

/** Office move-in: tenant, reservation, payment, then the eSign URL. A -95 failure stops here. */
export async function staffMoveIn(input: StaffBookInput) {
  const identity = leaseIdentity(input);
  const payMethod = input.payMethod ?? "card";
  const unit = await vacantUnit(input.locationKey, input.unitId, true);
  const loc = input.locationKey;
  const planReport = await sitelink.discountPlans(loc);
  const concessionId = await chooseHoldConcession(
    { locationKey: loc, concessionId: input.concessionId },
    unit,
    planReport.plans,
    planReport.source,
    await getDiscountToggles(),
  );
  if (input.concessionId !== null && planReport.source !== "sitelink") {
    throw new HoldError("concession", "Discount plans couldn't be loaded from SiteLink. Use standard 28-day billing or try again.");
  }
  let tenantId = 0;
  let waitingId = 0;
  try {
    const tenant = await sitelink.findOrCreateTenant(loc, input);
    tenantId = tenant.tenantId;
    await sitelink.updateTenantForLease(loc, tenantId, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      addr1: identity.addr1,
      city: identity.city,
      region: identity.region,
      postalCode: identity.postalCode,
      license: identity.licenseNumber,
      licRegion: identity.licenseRegion,
    });
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    waitingId = await sitelink.createReservation(loc, {
      tenantId,
      unitId: unit.unitId,
      needed: input.moveInDate,
      expires,
      quotedRate: unit.rate,
      comment: concessionId ? `Staff move-in · concession ${concessionId}` : "Staff move-in · standard 28-day billing",
      trackingCode: "staff-move-in",
      concessionId,
    });
    const cost = await sitelink.moveInCost(loc, {
      unitId: unit.unitId,
      moveInDate: input.moveInDate,
      waitingId,
      concessionId,
    });
    const method = payMethod === "cash" ? PAY_METHOD_CASH : payMethod === "check" ? PAY_METHOD_CHECK : PAY_METHOD_CREDIT_CARD;
    let card: { typeId: number; number: string; cvv: string; expires: Date; name: string; street: string; postal: string };
    if (method === PAY_METHOD_CREDIT_CARD) {
      const parsed = parsedCard(input.card);
      card = { ...parsed, typeId: await cardTypeId(loc, parsed.number) };
    } else {
      card = {
        typeId: 0,
        number: "",
        cvv: "",
        expires: DUMMY_CARD_EXPIRY,
        name: `${input.firstName} ${input.lastName}`.trim(),
        street: identity.addr1,
        postal: identity.postalCode,
      };
    }
    const moved = await sitelink.moveInWithCard(loc, {
      tenantId,
      unitId: unit.unitId,
      waitingId,
      startDate: cost.startDate ? new Date(cost.startDate) : input.moveInDate,
      endDate: cost.endDate,
      concessionId,
      payMethod: method,
      amount: cost.total,
      card,
    });
    if (payMethod === "check" && text(input.checkNumber) && waitingId) {
      await sitelink.reservationNote(loc, waitingId, `Staff move-in check / e-transfer reference ${text(input.checkNumber)}`).catch(() => undefined);
    }
    let autoBillEnabled = false;
    if (method === PAY_METHOD_CREDIT_CARD && input.saveCard) {
      try {
        await sitelink.enableAutoBillCard(loc, {
          ledgerId: moved.ledgerId,
          cardTypeId: card.typeId,
          cardNumber: card.number,
          expires: card.expires,
          name: card.name,
          street: card.street,
          postal: card.postal,
        });
        autoBillEnabled = true;
      } catch (err) {
        log.warn("staff move-in auto-bill failed; move-in stands", { location: loc, ledgerId: moved.ledgerId, err });
      }
    }
    const leaseUrl = moved.ledgerId ? await sitelink.leaseUrl(loc, tenantId, moved.ledgerId, `${env.APP_URL}/admin/tenants/${loc}/${tenantId}`) : null;
    const id = randomBytes(18).toString("base64url");
    await db.hold.create({
      data: {
        id,
        locationKey: loc,
        unitId: unit.unitId,
        unitName: unit.unitName,
        unitTypeName: unit.typeName,
        widthFt: unit.widthFt,
        lengthFt: unit.lengthFt,
        tenantId,
        waitingId,
        quotedRate: unit.rate,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        licenseNumber: identity.licenseNumber,
        licenseRegion: identity.licenseRegion,
        addr1: identity.addr1,
        city: identity.city,
        region: identity.region,
        postalCode: identity.postalCode,
        concessionId,
        autoBillEnabled,
        staffIssued: true,
        moveInDate: input.moveInDate,
        expiresAt: new Date(),
        status: "moved_in",
        costBreakdown: cost,
        ledgerId: moved.ledgerId || null,
        paymentRef: moved.receiptRef,
      },
    });
    if (moved.ledgerId) {
      await db.paymentReceipt.create({
        data: {
          locationKey: loc,
          tenantId,
          ledgerId: moved.ledgerId,
          holdId: id,
          amount: cost.total,
          paymentRef: moved.receiptRef,
          description: `Staff move-in · ${payMethod} · unit ${unit.unitName}`,
          periodLabel: "Move-in",
        },
      });
    }
    return {
      holdId: id,
      tenantId,
      ledgerId: moved.ledgerId || null,
      receiptRef: moved.receiptRef,
      leaseUrl,
      autoBillEnabled,
      total: cost.total,
    };
  } catch (err) {
    throw asHoldError(err, "The move-in did not complete. Check SiteLink before trying again so the tenant is not charged twice.");
  }
}

export async function takeStaffPayment(input: StaffPayInput) {
  if (!(input.amount > 0) || input.amount > 100_000) throw new HoldError("amount", "Enter a payment amount greater than zero.");
  const loc = input.locationKey;
  try {
    let receiptId: string | null = null;
    if (input.method === "cash") {
      receiptId = (await sitelink.paymentSimpleCash(loc, { tenantId: input.tenantId, unitId: input.unitId, amount: input.amount })).receiptId;
    } else if (input.method === "check") {
      const checkNumber = text(input.checkNumber);
      if (checkNumber.length < 1 || checkNumber.length > 40) throw new HoldError("check", "Enter the check number or e-transfer reference.");
      receiptId = (await sitelink.paymentSimpleCheck(loc, { tenantId: input.tenantId, unitId: input.unitId, amount: input.amount, checkNumber })).receiptId;
    } else {
      const parsed = parsedCard(input.card);
      const typeId = await cardTypeId(loc, parsed.number);
      receiptId = (
        await sitelink.paymentSimpleCard(loc, {
          tenantId: input.tenantId,
          unitId: input.unitId,
          amount: input.amount,
          card: { ...parsed, typeId },
        })
      ).receiptId;
      if (input.saveCard) {
        try {
          await sitelink.enableAutoBillCard(loc, {
            ledgerId: input.ledgerId,
            cardTypeId: typeId,
            cardNumber: parsed.number,
            expires: parsed.expires,
            name: parsed.name,
            street: parsed.street,
            postal: parsed.postal,
          });
        } catch (err) {
          log.warn("payment saved but auto-bill update failed", { location: loc, ledgerId: input.ledgerId, err });
          await db.paymentReceipt.create({
            data: {
              locationKey: loc,
              tenantId: input.tenantId,
              ledgerId: input.ledgerId,
              amount: input.amount,
              paymentRef: receiptId,
              description: `Staff payment · card · unit ${input.unitName}`,
              periodLabel: "Payment",
            },
          });
          return { receiptId, autoBillEnabled: false, autoBillError: "Payment was taken. Saving the card for auto-bill did not complete." };
        }
      }
    }
    await db.paymentReceipt.create({
      data: {
        locationKey: loc,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        amount: input.amount,
        paymentRef: receiptId,
        description: `Staff payment · ${input.method} · unit ${input.unitName}`,
        periodLabel: "Payment",
      },
    });
    return { receiptId, autoBillEnabled: input.method === "card" && Boolean(input.saveCard), autoBillError: null as string | null };
  } catch (err) {
    throw asHoldError(err, "SiteLink did not accept that payment. Check the ledger before trying again.");
  }
}

export async function updateStaffBilling(input: {
  locationKey: LocationKey;
  ledgerId: number;
  autoBill: boolean;
  card?: StaffCard;
}) {
  try {
    if (!input.autoBill) {
      await sitelink.updateTenantBilling(input.locationKey, { ledgerId: input.ledgerId, autoBill: false });
      return { autoBill: false };
    }
    const parsed = parsedCard(input.card);
    const typeId = await cardTypeId(input.locationKey, parsed.number);
    await sitelink.updateTenantBilling(input.locationKey, {
      ledgerId: input.ledgerId,
      autoBill: true,
      card: { typeId, number: parsed.number, expires: parsed.expires, name: parsed.name, street: parsed.street, postal: parsed.postal },
    });
    return { autoBill: true };
  } catch (err) {
    throw asHoldError(err, "SiteLink did not update the card on file. The existing auto-bill setting is unchanged.");
  }
}
