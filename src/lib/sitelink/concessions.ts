import { isWinterStoragePackage } from "../catalog";
import type { ConcessionPlan } from "./types";

/** One KV billing period. SiteLink iBillingFrequency 7. */
export const BILLING_PERIOD_DAYS = 28;

/** Simulator ConcessionID only. Live checkout uses the id DiscountPlansRetrieve returns. */
export const MOCK_WINTER_CONCESSION_ID = 39906;

export const WINTER_PLAN_NAME = "$399 6-Month Winter Outdoor Storage Package";

export const WINTER_PLAN_DESCRIPTION =
  "Prepaid 6-period winter outdoor storage for vehicles, RVs and boats at Exit 31. Fixed $399 before HST. Each period is 28 days.";

export const STANDARD_BILLING_LABEL = "Standard 28-day billing";

export const RATE_CYCLE_SUFFIX = "/28 days + HST";
export const PACKAGE_RATE_SUFFIX = "6-month package + HST";

export function rateSuffix(typeName: string): string {
  return isWinterStoragePackage(typeName) ? PACKAGE_RATE_SUFFIX : RATE_CYCLE_SUFFIX;
}

/** Advance a SiteLink wall-clock datetime by whole days without shifting the clock time. */
export function addBillingDays(startRaw: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(startRaw);
  const base = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])))
    : new Date(startRaw);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base.getUTCFullYear()}-${p(base.getUTCMonth() + 1)}-${p(base.getUTCDate())}T${p(base.getUTCHours())}:${p(base.getUTCMinutes())}:${p(base.getUTCSeconds())}`;
}

export function paidThroughDate(start: Date, end: Date | string | null | undefined, periods = 1): Date {
  if (end instanceof Date && end.getTime() > start.getTime()) return end;
  if (typeof end === "string" && end) {
    const parsed = new Date(end);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > start.getTime()) return parsed;
  }
  const next = new Date(start.getTime());
  next.setUTCDate(next.getUTCDate() + BILLING_PERIOD_DAYS * Math.max(1, periods));
  return next;
}

/** True when the move-in cost covers more than one 28-day period (a prepaid concession). */
export function isMultiPeriodPrepaid(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false;
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return Number.isFinite(days) && days > BILLING_PERIOD_DAYS + 1;
}

export function recurringBillingNote(prepaid: boolean): string {
  return prepaid
    ? "Your card will be saved for automatic recurring billing every 28 days, starting after this prepaid period."
    : "Your card will be saved for automatic recurring billing every 28 days.";
}

const SIX_PERIOD_RE = /6[-\s]?month|six[-\s]?month|6[-\s]?period/;
const WINTER_RE = /winter|outdoor|vehicle|\brv\b|boat|399/;

/** A SiteLink plan we can attach to the Exit 31 winter outdoor package. */
export function isWinterPrepaidPlan(plan: ConcessionPlan): boolean {
  if (plan.disabled || !plan.prepay) return false;
  const text = `${plan.name} ${plan.description} ${plan.comment}`;
  const six = plan.prepaidMonths >= 6 || SIX_PERIOD_RE.test(text);
  const winterish = WINTER_RE.test(text) || plan.chargeAmount === 399;
  return six && winterish;
}

/** Prefer the $399 / winter-named plan when SiteLink returns more than one prepaid match. */
export function matchingWinterPrepaidPlan(plans: ConcessionPlan[]): ConcessionPlan | null {
  const matches = plans.filter(isWinterPrepaidPlan);
  return (
    matches.find((p) => p.chargeAmount === 399 || /399/.test(`${p.name} ${p.description}`)) ??
    matches.find((p) => /winter/i.test(p.name)) ??
    matches[0] ??
    null
  );
}

type PlanUnit = { unitTypeId?: number; typeName: string; widthFt: number; lengthFt: number };

export function discountToggleKey(locationKey: string, concessionId: number) {
  return `${locationKey}:${concessionId}`;
}

/** SiteLink would show this plan on a website move-in before any staff override. */
export function isWebEnabledPlan(plan: ConcessionPlan) {
  return !plan.disabled && plan.showOn !== 2;
}

/**
 * Staff On/Off wins when a row exists. With no row, web-enabled plans stay On
 * and payments-only or disabled plans stay Off.
 */
export function planShownOnWebsite(plan: ConcessionPlan, locationKey: string, toggles: Record<string, boolean>) {
  const key = discountToggleKey(locationKey, plan.concessionId);
  if (Object.prototype.hasOwnProperty.call(toggles, key)) return toggles[key] === true;
  return isWebEnabledPlan(plan);
}

/** Unit match only. Disabled and payments-only plans can still match when staff turns them On. */
export function planMatchesUnit(plan: ConcessionPlan, unit: PlanUnit): boolean {
  if (plan.forAllUnits || plan.unitTypes.length === 0) return true;
  const sized = plan.unitTypes.some((t) => t.widthFt > 0 && t.lengthFt > 0);
  const direct = plan.unitTypes.some((t) => {
    if (unit.unitTypeId && t.unitTypeId && unit.unitTypeId === t.unitTypeId) return true;
    if (t.typeName && t.typeName.toLowerCase() === unit.typeName.toLowerCase()) return true;
    if (t.widthFt > 0 && t.lengthFt > 0 && t.widthFt === unit.widthFt && t.lengthFt === unit.lengthFt) return true;
    return false;
  });
  if (direct) return true;
  return !sized && isWinterPrepaidPlan(plan) && isWinterStoragePackage(unit.typeName);
}

/** ConcessionUnitTypes empty, or bForAllUnits, means the plan applies to every unit. */
export function planAppliesTo(plan: ConcessionPlan, unit: PlanUnit): boolean {
  if (plan.disabled || plan.showOn === 2) return false;
  return planMatchesUnit(plan, unit);
}

export function plansForUnit(plans: ConcessionPlan[], unit: PlanUnit): ConcessionPlan[] {
  return plans.filter((p) => planAppliesTo(p, unit));
}

/** Plans the public checkout and staff booking form may charge. */
export function publicPlansForUnit(plans: ConcessionPlan[], unit: PlanUnit, locationKey: string, toggles: Record<string, boolean>): ConcessionPlan[] {
  return plans.filter((p) => planShownOnWebsite(p, locationKey, toggles) && planMatchesUnit(p, unit));
}

/** Blank, 0, and -999 mean standard 28-day billing (no concession). */
export function parseConcessionId(value: unknown): { ok: true; id: number | null } | { ok: false } {
  if (value === undefined || value === null || value === "" || value === "0" || value === 0 || value === -999 || value === "-999") {
    return { ok: true, id: null };
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0) return { ok: false };
  return { ok: true, id: n };
}
