import "server-only";
import { randomBytes } from "node:crypto";
import type { Hold, Prisma } from "@prisma/client";
import type { LocationKey } from "@/config/locations";
import { cardBrand, digitsOnly, luhnValid, parseExpiry, paymentTypeIdFor } from "./card";
import { formatSize, isWinterStoragePackage } from "./catalog";
import { getDiscountToggles } from "./discount-visibility";
import { discountToggleKey, matchingWinterPrepaidPlan, planMatchesUnit, planShownOnWebsite, publicPlansForUnit } from "./sitelink/concessions";
import { db } from "./db";
import { cookieNames, env } from "./env";
import { getInventory, refreshInventory } from "./inventory";
import { captureLead } from "./leads";
import { log, safeErrorMessage } from "./log";
import { notifyStaff } from "./notify";
import { getSettings } from "./settings";
import { sitelink, SiteLinkError } from "./sitelink/client";
import { RESERVATION_CANCEL_TYPE, RESERVATION_STATUS_CANCELLED } from "./sitelink/enums";
import type { MoveInCost } from "./sitelink/types";
import { BLOCKING_HOLD_STATUSES } from "./hold-status";
import { parseTenantVerification, verificationNote } from "./tenant-verification";

export const HOLD_COOKIE = cookieNames.hold;
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
  /**
   * undefined keeps the public default (auto winter package when that plan is shown).
   * null is standard 28-day billing. A number is used only when that plan is shown for the unit.
   */
  concessionId?: number | null;
  /** Staff checkout link. Lasts holdMs (default 72 hours) and carries a claim token. */
  staffIssued?: boolean;
  holdMs?: number;
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
          concessionId: h.concessionId,
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
  if (!unit) throw new HoldError("unit not in cache", "This unit is no longer available. Check the other units at this location.");

  let fresh = unit;
  try {
    const live = await sitelink.unitById(input.locationKey, input.unitId);
    if (!live || live.rented || !live.rentable || live.waitingListReserved) {
      throw new HoldError("unit no longer vacant in SiteLink", "This unit is no longer available. Check the other units at this location.");
    }
    fresh = live;
  } catch (err) {
    if (!isSiteLinkPermissionDenied(err)) throw err;
    log.warn("SiteLink unit lookup returned -95; holding the verified catalog unit", { location: input.locationKey, unitId: input.unitId });
  }

  const planReport = await sitelink.discountPlans(input.locationKey);
  const toggles = await getDiscountToggles();
  const concessionId = await chooseHoldConcession(input, fresh, planReport.plans, planReport.source, toggles);

  const id = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + (input.holdMs ?? settings.holdMinutes * 60_000));
  const claimToken = input.staffIssued ? randomBytes(18).toString("base64url") : null;
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
        concessionId,
        staffIssued: Boolean(input.staffIssued),
        claimToken,
      },
    });
  } catch {
    throw new HoldError("unit already held", "Someone is checking out this unit right now. Please pick another, or try again in a few minutes.");
  }

  let tenantId: number | undefined;
  let created = false;
  let waitingId: number | undefined;
  try {
    const tenant = await sitelink.findOrCreateTenant(input.locationKey, input);
    tenantId = tenant.tenantId;
    created = tenant.created;
    waitingId = await sitelink.createReservation(input.locationKey, {
      tenantId,
      unitId: unit.unitId,
      needed: input.moveInDate,
      expires: expiresAt,
      quotedRate: Number(hold.quotedRate),
      comment: input.staffIssued
        ? concessionId
          ? `Staff checkout link · concession ${concessionId}`
          : "Staff checkout link · standard 28-day billing"
        : concessionId
          ? `Website ${settings.holdMinutes}-minute checkout hold · concession ${concessionId}`
          : `Website ${settings.holdMinutes}-minute checkout hold`,
      trackingCode: `web-${id.slice(0, 10)}`,
      concessionId,
    });
  } catch (err) {
    if (!isSiteLinkPermissionDenied(err)) {
      await db.hold.update({ where: { id }, data: { status: "error", lastFailure: safeErrorMessage(err) } });
      throw new HoldError(safeErrorMessage(err), "We couldn't hold that space for you. Please try again or call (902) 867-3779.");
    }
    log.warn("SiteLink reservation returned -95; website hold kept on the verified catalog", { holdId: id });
  }
  let cost: MoveInCost | null = null;
  if (waitingId) {
    try {
      cost = await sitelink.moveInCost(input.locationKey, {
        unitId: unit.unitId,
        moveInDate: input.moveInDate,
        waitingId,
        concessionId,
      });
    } catch (err) {
      log.warn("move-in cost retrieve failed", { holdId: id, err });
    }
  }
  return await db.hold.update({
    where: { id },
    data: {
      tenantId,
      tenantCreated: created,
      waitingId,
      concessionId,
      costBreakdown: (cost ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Corporate Control Center has not granted this API user yet. */
export function isSiteLinkPermissionDenied(err: unknown): boolean {
  return err instanceof SiteLinkError && err.code === -95;
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
    const cost = await sitelink.moveInCost(hold.locationKey as LocationKey, {
      unitId: hold.unitId,
      moveInDate: hold.moveInDate,
      waitingId: hold.waitingId,
      concessionId: hold.concessionId,
    });
    return db.hold.update({ where: { id: hold.id }, data: { costBreakdown: cost as unknown as Prisma.InputJsonValue } });
  } catch {
    return hold;
  }
}

type HoldUnit = { unitTypeId?: number; typeName: string; widthFt: number; lengthFt: number };

/** Picks the concession stored on a new hold. An explicit Off toggle is never charged. */
export async function chooseHoldConcession(
  input: Pick<HoldInput, "locationKey" | "concessionId">,
  unit: HoldUnit,
  plans: Awaited<ReturnType<typeof sitelink.discountPlans>>["plans"],
  source: "sitelink" | "unavailable",
  toggles: Record<string, boolean>,
): Promise<number | null> {
  if (input.concessionId === null) return null;
  if (input.concessionId === undefined) {
    if (!isWinterStoragePackage(unit.typeName)) return null;
    return matchingWinterPrepaidPlan(publicPlansForUnit(plans, unit, input.locationKey, toggles))?.concessionId ?? null;
  }
  const id = input.concessionId;
  if (toggles[discountToggleKey(input.locationKey, id)] === false) {
    throw new HoldError("concession", "That discount is turned off on the website. Standard 28-day billing is still available.");
  }
  if (source !== "sitelink") return id;
  const eligible = publicPlansForUnit(plans, unit, input.locationKey, toggles);
  if (!eligible.some((p) => p.concessionId === id)) {
    throw new HoldError("concession", "That discount plan doesn't apply to this unit. Standard 28-day billing is still available.");
  }
  return id;
}

/** Blocks payment and confirmation when the stored plan was turned Off or no longer matches the unit. */
export async function assertChargeableConcession(hold: Hold): Promise<void> {
  if (hold.concessionId == null) return;
  const loc = hold.locationKey as LocationKey;
  const toggles = await getDiscountToggles();
  if (toggles[discountToggleKey(loc, hold.concessionId)] === false) {
    throw new HoldError("concession", "That discount is turned off on the website. Choose standard 28-day billing.");
  }
  const report = await sitelink.discountPlans(loc);
  if (report.source !== "sitelink") return;
  const plan = report.plans.find((p) => p.concessionId === hold.concessionId);
  const unit = { typeName: hold.unitTypeName, widthFt: hold.widthFt, lengthFt: hold.lengthFt };
  if (!plan || !planShownOnWebsite(plan, loc, toggles) || !planMatchesUnit(plan, unit)) {
    throw new HoldError("concession", "That discount plan doesn't apply to this unit. Standard 28-day billing is still available.");
  }
}

/** Saves a concession (or clears it) and refreshes the 28-day move-in quote. */
export async function quoteHold(hold: Hold, concessionId: number | null): Promise<Hold> {
  const loc = hold.locationKey as LocationKey;
  if (concessionId !== null) {
    const report = await sitelink.discountPlans(loc);
    const toggles = await getDiscountToggles();
    await chooseHoldConcession({ locationKey: loc, concessionId }, { typeName: hold.unitTypeName, widthFt: hold.widthFt, lengthFt: hold.lengthFt }, report.plans, report.source, toggles);
    if (report.source !== "sitelink" && hold.concessionId !== concessionId && toggles[discountToggleKey(loc, concessionId)] !== true) {
      throw new HoldError("concession", "That discount plan doesn't apply to this unit. Standard 28-day billing is still available.");
    }
  }
  if (hold.waitingId && hold.tenantId) {
    try {
      await sitelink.updateReservation(loc, {
        waitingId: hold.waitingId,
        tenantId: hold.tenantId,
        unitId: hold.unitId,
        needed: hold.moveInDate,
        expires: hold.expiresAt,
        quotedRate: Number(hold.quotedRate),
        comment: concessionId ? `Website checkout · concession ${concessionId}` : "Website checkout · standard 28-day billing",
        concessionId,
      });
    } catch (err) {
      if (!isSiteLinkPermissionDenied(err)) {
        throw new HoldError(safeErrorMessage(err), "We couldn't apply that billing plan. Please try again or call (902) 867-3779.");
      }
      log.warn("reservation concession update returned -95", { holdId: hold.id });
    }
  }
  let cost = (hold.costBreakdown as unknown as MoveInCost | null) ?? null;
  if (hold.waitingId) {
    try {
      cost = await sitelink.moveInCost(loc, {
        unitId: hold.unitId,
        moveInDate: hold.moveInDate,
        waitingId: hold.waitingId,
        concessionId,
      });
    } catch (err) {
      if (!isSiteLinkPermissionDenied(err)) {
        throw new HoldError(safeErrorMessage(err), "We couldn't update your move-in total. Please try again or call (902) 867-3779.");
      }
      log.warn("move-in cost with concession returned -95", { holdId: hold.id });
    }
  }
  return db.hold.update({
    where: { id: hold.id },
    data: { concessionId, costBreakdown: (cost ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}

export async function recordAutoBillEnabled(id: string): Promise<void> {
  await db.hold.update({ where: { id }, data: { autoBillEnabled: true } });
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
    throw new HoldError("hold not active", "Your unit hold has ended. Check availability and start a new hold.");
  }
}

/**
 * Saves license, mailing address, and ID photo onto the SiteLink tenant before
 * payment or reservation confirmation. TenantUpdate_v3 must succeed. A failed
 * TenantImageUpload is logged and does not stop checkout. Image bytes are not stored.
 */
export async function syncTenantVerification(h: Hold, body: Record<string, unknown>): Promise<Hold> {
  const parsed = parseTenantVerification(body);
  if (!parsed.ok) throw new HoldError("verification", parsed.error);
  if (!h.tenantId) throw new HoldError("verification", "We couldn't find your rental profile. Call (902) 867-3779.");
  const loc = h.locationKey as LocationKey;
  const v = parsed.value;
  try {
    await sitelink.updateTenantForLease(loc, h.tenantId, {
      firstName: h.firstName,
      lastName: h.lastName,
      email: h.email,
      phone: h.phone,
      addr1: v.addr1,
      city: v.city,
      region: v.region,
      postalCode: v.postalCode,
      license: v.licenseNumber,
      licRegion: v.licenseRegion,
    });
  } catch (err) {
    throw new HoldError(
      safeErrorMessage(err),
      "We couldn't save your address and driver's license for the lease. Please try again or call (902) 867-3779.",
    );
  }

  let idPhotoUploaded = false;
  try {
    await sitelink.uploadTenantImage(loc, h.tenantId, v.imageBase64, v.fileName);
    idPhotoUploaded = true;
  } catch (err) {
    log.warn("TenantImageUpload failed; continuing checkout", { holdId: h.id, err });
  }

  const updated = await db.hold.update({
    where: { id: h.id },
    data: {
      licenseNumber: v.licenseNumber,
      licenseRegion: v.licenseRegion,
      addr1: v.addr1,
      city: v.city,
      region: v.region,
      postalCode: v.postalCode,
      idPhotoUploaded,
    },
  });

  const note = verificationNote(v, idPhotoUploaded);
  if (h.waitingId) await sitelink.reservationNote(loc, h.waitingId, note).catch(() => undefined);
  await captureLead({
    channel: "website_form",
    reason: "contact_request",
    name: `${h.firstName} ${h.lastName}`,
    phone: h.phone,
    email: h.email,
    locationKey: loc,
    unitType: h.unitTypeName,
    unitSize: formatSize(h.widthFt, h.lengthFt),
    notes: note,
    externalId: `checkout:${h.id}`,
  }).catch((err) => log.warn("checkout verification lead sync failed", { holdId: h.id, err }));
  return updated;
}

/** PAYMENT_MODE=pay_separately: keep the SiteLink reservation open longer and hand payment to the office / pay-online page. */
export async function confirmPaySeparately(id: string, verification: Record<string, unknown>, concessionId?: number | null): Promise<Hold> {
  let h = await db.hold.findUnique({ where: { id } });
  assertActive(h);
  if (concessionId !== undefined && concessionId !== h.concessionId) h = await quoteHold(h, concessionId);
  await assertChargeableConcession(h);
  await syncTenantVerification(h, verification);
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
      comment: h.concessionId
        ? `Website reservation confirmed — concession ${h.concessionId}. Payment to be taken by office / pay-online page`
        : "Website reservation confirmed — standard 28-day billing. Payment to be taken by office / pay-online page",
      concessionId: h.concessionId,
    });
    await sitelink.reservationNote(loc, h.waitingId!, `Website: customer confirmed reservation. Pay separately (PAYMENT_MODE=pay_separately). Phone ${h.phone}, email ${h.email}.`).catch(() => undefined);
  } catch (err) {
    throw new HoldError(safeErrorMessage(err), "We couldn't confirm your reservation. Try again or call (902) 867-3779.");
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
export async function payPassthrough(id: string, card: CardInput, verification: Record<string, unknown>, concessionId?: number | null): Promise<Hold> {
  if (env.PAYMENT_MODE !== "passthrough") throw new HoldError("passthrough disabled", "Online card payment isn't enabled.");
  let h = await db.hold.findUnique({ where: { id } });
  assertActive(h);
  if (concessionId !== undefined && concessionId !== h.concessionId) h = await quoteHold(h, concessionId);
  await assertChargeableConcession(h);
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
  await syncTenantVerification(h, verification);

  try {
    const start = cost.startDate ? new Date(cost.startDate) : h.moveInDate;
    const result = await sitelink.moveInWithCard(loc, {
      tenantId: h.tenantId!,
      unitId: h.unitId,
      waitingId: h.waitingId!,
      startDate: Number.isNaN(start.getTime()) ? h.moveInDate : start,
      endDate: cost.endDate,
      concessionId: h.concessionId,
      amount: cost.total,
      card: { typeId, number, cvv, expires, name: card.name.trim(), street: card.street.trim(), postal: card.postal.trim() },
    });
    const updated = await db.hold.update({
      where: { id },
      data: { status: "moved_in", ledgerId: result.ledgerId || null, paymentRef: result.receiptRef, lastFailure: null },
    });
    await db.paymentReceipt.create({
      data: {
        locationKey: loc,
        tenantId: h.tenantId!,
        ledgerId: result.ledgerId || null,
        holdId: id,
        amount: cost.total,
        paymentRef: result.receiptRef,
        description: `Move-in payment · unit ${h.unitName}`,
        periodLabel: "Move-in",
      },
    });
    if (env.sitelinkMode === "mock") {
      await refreshInventory({ force: true, kinds: ["available"] }).catch((err) => log.warn("post-move-in inventory refresh failed", { err }));
    }
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
        ? "We couldn't confirm your payment after a few tries. We've let the office know. Please call (902) 867-3779 before trying again so we can check it."
        : "We couldn't confirm your payment. Please call (902) 867-3779 before trying again so we can check it.",
    );
  }
}
