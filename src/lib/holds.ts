import "server-only";
import { randomBytes } from "node:crypto";
import type { Hold, Prisma } from "@prisma/client";
import type { LocationKey } from "@/config/locations";
import { cardBrand, digitsOnly, luhnValid, parseExpiry, paymentTypeIdFor } from "./card";
import { db } from "./db";
import { env } from "./env";
import { getInventory } from "./inventory";
import { log, safeErrorMessage } from "./log";
import { notifyStaff } from "./notify";
import { getSettings } from "./settings";
import { sitelink, SiteLinkError } from "./sitelink/client";
import { RESERVATION_CANCEL_TYPE, RESERVATION_STATUS_CANCELLED } from "./sitelink/enums";
import type { MoveInCost } from "./sitelink/types";
import { BLOCKING_HOLD_STATUSES } from "./hold-status";

export const HOLD_COOKIE = "kv_hold";
const MAX_PAYMENT_ATTEMPTS = 3;

export class HoldError extends Error {
  constructor(
    message: string,
    public userMessage: string,
  ) {
    super(message);
  }
}

export type HoldInput = {
  locationKey: LocationKey;
  unitId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  moveInDate: Date;
};

/** Marks lapsed holds expired and (only if SiteLink confirmed the status enum) cancels them there too. */
export async function expireHolds(): Promise<number> {
  const lapsed = await db.hold.findMany({ where: { status: { in: BLOCKING_HOLD_STATUSES }, expiresAt: { lte: new Date() } } });
  for (const h of lapsed) {
    await db.hold.update({ where: { id: h.id }, data: { status: "expired" } });
    if (RESERVATION_STATUS_CANCELLED !== null && h.waitingId && h.tenantId) {
      try {
        await sitelink.updateReservation(h.locationKey as LocationKey, {
          waitingId: h.waitingId,
          tenantId: h.tenantId,
          unitId: h.unitId,
          needed: h.moveInDate,
          expires: h.expiresAt,
          quotedRate: Number(h.quotedRate),
          comment: "Website hold expired",
          status: RESERVATION_STATUS_CANCELLED,
          cancellationTypeId: RESERVATION_CANCEL_TYPE,
          cancellationReason: "Website 20-minute hold expired",
        });
      } catch (err) {
        log.warn("could not release expired hold in SiteLink", { holdId: h.id, err });
      }
    }
  }
  return lapsed.length;
}

export async function createHold(input: HoldInput): Promise<Hold> {
  const settings = await getSettings();
  if (settings.maintenanceMode) throw new HoldError("maintenance", settings.maintenanceMessage);
  await expireHolds();

  const inventory = await getInventory();
  const unit = inventory.find((l) => l.location === input.locationKey)?.units.find((u) => u.unitId === input.unitId);
  if (!unit) throw new HoldError("unit not in cache", "Sorry — that unit was just taken. Here are the others that are still open.");

  const fresh = await sitelink.unitById(input.locationKey, input.unitId);
  if (!fresh || fresh.rented || !fresh.rentable || fresh.waitingListReserved) {
    throw new HoldError("unit no longer vacant in SiteLink", "Sorry — that unit was just rented. Here are the others that are still open.");
  }

  const id = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + settings.holdMinutes * 60_000);
  let hold: Hold;
  try {
    // The partial unique index (one active hold per unit) makes this the claim.
    hold = await db.hold.create({
      data: {
        id,
        locationKey: input.locationKey,
        unitId: unit.unitId,
        unitName: unit.unitName,
        unitTypeName: unit.typeName,
        widthFt: unit.widthFt,
        lengthFt: unit.lengthFt,
        quotedRate: fresh.rate || unit.rate,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        moveInDate: input.moveInDate,
        expiresAt,
      },
    });
  } catch {
    throw new HoldError("unit already held", "Someone is checking out this unit right now. Please pick another, or try again in a few minutes.");
  }

  try {
    const { tenantId, created } = await sitelink.findOrCreateTenant(input.locationKey, input);
    const waitingId = await sitelink.createReservation(input.locationKey, {
      tenantId,
      unitId: unit.unitId,
      needed: input.moveInDate,
      expires: expiresAt,
      quotedRate: Number(hold.quotedRate),
      comment: `Website ${settings.holdMinutes}-minute checkout hold`,
      trackingCode: `web-${id.slice(0, 10)}`,
    });
    let cost: MoveInCost | null = null;
    try {
      cost = await sitelink.moveInCost(input.locationKey, { unitId: unit.unitId, moveInDate: input.moveInDate, waitingId });
    } catch (err) {
      log.warn("move-in cost retrieve failed", { holdId: id, err });
    }
    return await db.hold.update({
      where: { id },
      data: { tenantId, tenantCreated: created, waitingId, costBreakdown: (cost ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  } catch (err) {
    await db.hold.update({ where: { id }, data: { status: "error", lastFailure: safeErrorMessage(err) } });
    throw new HoldError(safeErrorMessage(err), "We couldn't place the hold with our booking system. Please try again or call (902) 867-3779.");
  }
}

export async function getHold(id: string): Promise<Hold | null> {
  const h = await db.hold.findUnique({ where: { id } });
  if (h && h.status === "active" && h.expiresAt <= new Date()) {
    await expireHolds();
    return db.hold.findUnique({ where: { id } });
  }
  return h;
}

export async function retryCost(hold: Hold): Promise<Hold> {
  if (hold.costBreakdown || !hold.waitingId) return hold;
  try {
    const cost = await sitelink.moveInCost(hold.locationKey as LocationKey, { unitId: hold.unitId, moveInDate: hold.moveInDate, waitingId: hold.waitingId });
    return db.hold.update({ where: { id: hold.id }, data: { costBreakdown: cost as unknown as Prisma.InputJsonValue } });
  } catch {
    return hold;
  }
}

export async function releaseHold(id: string) {
  const h = await db.hold.findUnique({ where: { id } });
  if (!h || h.status !== "active") return;
  await db.hold.update({ where: { id }, data: { expiresAt: new Date() } });
  await expireHolds();
  await db.hold.update({ where: { id }, data: { status: "released" } });
}

function assertActive(h: Hold | null): asserts h is Hold {
  if (!h) throw new HoldError("hold not found", "We couldn't find that reservation.");
  if (h.status !== "active" || h.expiresAt <= new Date()) {
    throw new HoldError("hold not active", "This hold has expired. The unit has gone back on the list — you can start again any time.");
  }
}

/** PAYMENT_MODE=pay_separately: keep the SiteLink reservation open longer and hand payment to the office / pay-online page. */
export async function confirmPaySeparately(id: string): Promise<Hold> {
  const h = await db.hold.findUnique({ where: { id } });
  assertActive(h);
  const settings = await getSettings();
  const newExpiry = new Date(Date.now() + settings.confirmedReservationHours * 3_600_000);
  const loc = h.locationKey as LocationKey;
  try {
    await sitelink.updateReservation(loc, {
      waitingId: h.waitingId!,
      tenantId: h.tenantId!,
      unitId: h.unitId,
      needed: h.moveInDate,
      expires: newExpiry,
      quotedRate: Number(h.quotedRate),
      comment: "Website reservation confirmed — payment to be taken by office / pay-online page",
    });
    await sitelink.reservationNote(loc, h.waitingId!, `Website: customer confirmed reservation. Pay separately (PAYMENT_MODE=pay_separately). Phone ${h.phone}, email ${h.email}.`).catch(() => undefined);
  } catch (err) {
    throw new HoldError(safeErrorMessage(err), "We couldn't confirm the reservation with our booking system. Please call (902) 867-3779 and we'll finish it with you.");
  }
  const updated = await db.hold.update({ where: { id }, data: { status: "confirmed_pay_separately", expiresAt: newExpiry } });
  await notifyStaff("hold_confirmed_pay_separately", `Website reservation ${h.unitName} (${loc}) for ${h.firstName} ${h.lastName} — collect payment`, {
    holdId: id,
    waitingId: h.waitingId,
    phone: h.phone,
    email: h.email,
  });
  return updated;
}

export type CardInput = { number: string; cvv: string; expiry: string; name: string; street: string; postal: string };

/**
 * PAYMENT_MODE=passthrough. `card` lives only in this call's memory and the
 * outbound SOAP request. Do not add logging, persistence or error reporting
 * that could capture it.
 */
export async function payPassthrough(id: string, card: CardInput): Promise<Hold> {
  if (env.PAYMENT_MODE !== "passthrough") throw new HoldError("passthrough disabled", "Online card payment isn't enabled.");
  const h = await db.hold.findUnique({ where: { id } });
  assertActive(h);
  const cost = h.costBreakdown as unknown as MoveInCost | null;
  if (!cost) throw new HoldError("no cost breakdown", "We couldn't load your exact total yet, so we can't take payment. Please refresh, or call us.");

  const number = digitsOnly(card.number);
  const expires = parseExpiry(card.expiry);
  const cvv = digitsOnly(card.cvv);
  if (!luhnValid(number)) throw new HoldError("invalid card", "That card number doesn't look right.");
  if (!expires) throw new HoldError("invalid expiry", "Please check the expiry date (MM/YY).");
  if (cvv.length < 3 || cvv.length > 4) throw new HoldError("invalid cvv", "Please check the security code.");
  if (!card.name.trim() || !card.street.trim() || !card.postal.trim()) throw new HoldError("missing billing", "Please fill in the billing name, street and postal code.");

  const loc = h.locationKey as LocationKey;
  const types = await sitelink.paymentTypes(loc);
  const typeId = paymentTypeIdFor(cardBrand(number), types);
  if (!typeId) throw new HoldError("unsupported brand", "We can't accept that card type online. Please use Visa or Mastercard, or call us.");

  try {
    const result = await sitelink.moveInWithCard(loc, {
      tenantId: h.tenantId!,
      unitId: h.unitId,
      waitingId: h.waitingId!,
      startDate: h.moveInDate,
      amount: cost.total,
      card: { typeId, number, cvv, expires, name: card.name.trim(), street: card.street.trim(), postal: card.postal.trim() },
    });
    const updated = await db.hold.update({
      where: { id },
      data: { status: "moved_in", ledgerId: result.ledgerId || null, paymentRef: result.receiptRef, lastFailure: null },
    });
    await notifyStaff("move_in_completed", `Website move-in ${h.unitName} (${loc}) — ${h.firstName} ${h.lastName}`, { holdId: id, ledgerId: result.ledgerId });
    return updated;
  } catch (err) {
    const reason = err instanceof SiteLinkError ? safeErrorMessage(err.message) : "Payment system unavailable";
    const failureCount = h.failureCount + 1;
    await db.hold.update({
      where: { id },
      data: { failureCount, lastFailure: reason, status: failureCount >= MAX_PAYMENT_ATTEMPTS ? "payment_failed" : "active" },
    });
    if (failureCount >= MAX_PAYMENT_ATTEMPTS) {
      await notifyStaff("payment_failed", `Website payment failed ${failureCount}× for ${h.unitName} (${loc})`, { holdId: id, phone: h.phone, email: h.email });
    }
    throw new HoldError(
      reason,
      failureCount >= MAX_PAYMENT_ATTEMPTS
        ? "Your payment didn't go through after a few tries. Nothing was charged. We've let the office know — please call (902) 867-3779."
        : "The payment didn't go through and nothing was charged. Please check your card details and try again.",
    );
  }
}
