/**
 * DataSet row -> domain object mapping. Column names are taken from the
 * SiteLink v2.19 docs; where versions differ we accept several candidates.
 * If a live response uses a different column, fix it HERE only (staff can see
 * raw rows on /admin/tenants during go-live to confirm).
 */
import type { LocationKey } from "@/config/locations";
import { bool, date, num, optNum, str, type DataSet, type Row } from "./dataset";
import type { Balance, BillingInfo, CostLine, CostLineKind, Ledger, MoveInCost, PriceListEntry, Reservation, ReportSummary, Tenant, Unit } from "./types";

const VEHICLE_RE = /(parking|rv|boat|vehicle|trailer|car\b|outdoor)/i;

export function rowsOf(data: DataSet, ...preferred: string[]): Row[] {
  for (const t of preferred) if (data[t]?.length) return data[t];
  const firstNonRt = Object.keys(data).find((k) => k !== "RT");
  return firstNonRt ? data[firstNonRt] : [];
}

export function mapUnit(locationKey: LocationKey, r: Row): Unit {
  const width = num(r, "dcWidth");
  const length = num(r, "dcLength");
  const standardRate = num(r, "dcStdRate", "dcStandardRate");
  const webRate = optNum(r, "dcWebRate");
  const typeName = str(r, "sTypeName", "sUnitTypeName") || "Storage unit";
  return {
    locationKey,
    unitId: num(r, "UnitID", "iUnitID"),
    unitName: str(r, "sUnitName"),
    unitTypeId: num(r, "UnitTypeID", "iUnitTypeID"),
    typeName,
    widthFt: width,
    lengthFt: length,
    areaSqFt: Math.round(width * length),
    floor: optNum(r, "iFloor"),
    climate: bool(r, "bClimate"),
    power: bool(r, "bPower"),
    inside: bool(r, "bInside"),
    alarm: bool(r, "bAlarm"),
    vehicle: VEHICLE_RE.test(typeName) || bool(r, "bVehicle", "bParking"),
    rate: webRate && webRate > 0 ? webRate : standardRate,
    standardRate,
    rented: bool(r, "bRented"),
    rentable: r.bRentable === undefined ? true : bool(r, "bRentable"),
    excludedFromWebsite: bool(r, "bExcludeFromWebsite", "bExcludedFromWebsite"),
    waitingListReserved: bool(r, "bWaitingListReserved", "bReserved"),
    description: str(r, "sUnitDesc", "sUnitNote"),
  };
}

export function mapPriceList(locationKey: LocationKey, r: Row): PriceListEntry {
  return {
    locationKey,
    unitTypeId: num(r, "UnitTypeID", "iUnitTypeID"),
    typeName: str(r, "sTypeName", "sUnitTypeName"),
    widthFt: num(r, "dcWidth"),
    lengthFt: num(r, "dcLength"),
    climate: bool(r, "bClimate"),
    standardRate: num(r, "dcStdRate", "dcStandardRate"),
    webRate: optNum(r, "dcWebRate"),
    vacant: optNum(r, "iTotalVacant", "iVacant", "iUnitsVacant"),
    total: optNum(r, "iTotalUnits", "iUnits"),
  };
}

const TAX_KEYS = ["dcTax1", "dcTax2", "TaxAmount", "TaxAmount1", "TaxAmount2", "dcTax"];

function kindOf(label: string): CostLineKind {
  if (/rent/i.test(label)) return "rent";
  if (/deposit/i.test(label)) return "deposit";
  if (/insur|protect/i.test(label)) return "insurance";
  if (/discount|promo|concession/i.test(label)) return "discount";
  if (/admin|fee|lock|setup/i.test(label)) return "fee";
  return "other";
}

/**
 * Builds the checkout breakdown. HST is ALWAYS its own line. If SiteLink
 * returns tax columns we use them; if it returns none at all we compute HST
 * locally so tax is still visible before payment (never only at charge time).
 */
export function mapMoveInCost(rows: Row[], hstRate: number, taxLabel = "HST (Nova Scotia)"): MoveInCost {
  const lines: CostLine[] = [];
  let tax = 0;
  let sawTaxColumn = false;
  let startDate: string | null = null;
  let endDate: string | null = null;
  for (const r of rows) {
    const label = str(r, "ChargeDescription", "sChgDesc", "sDesc", "sDescription") || "Charge";
    const amount = num(r, "ChargeAmount", "dcChargeAmount", "dcAmount", "dcPrice");
    const discount = num(r, "dcDiscount", "Discount", "dcDiscountAmount");
    if (amount) lines.push({ label, amount: round(amount), kind: kindOf(label) });
    if (discount) lines.push({ label: `${label} discount`, amount: -round(Math.abs(discount)), kind: "discount" });
    for (const k of TAX_KEYS) {
      if (r[k] !== undefined) {
        sawTaxColumn = true;
        tax += num(r, k);
      }
    }
    startDate ??= date(r, "StartDate", "dStartDate");
    endDate ??= date(r, "EndDate", "dEndDate");
  }
  const preTax = round(lines.reduce((s, l) => s + l.amount, 0));
  const taxSource = sawTaxColumn ? "sitelink" : "computed";
  if (!sawTaxColumn) tax = preTax * hstRate;
  tax = round(tax);
  return { lines, preTax, tax, taxLabel, total: round(preTax + tax), taxSource, startDate, endDate };
}

export function mapTenant(r: Row): Tenant {
  return {
    tenantId: num(r, "TenantID", "iTenantID"),
    firstName: str(r, "sFName"),
    lastName: str(r, "sLName"),
    email: str(r, "sEmail"),
    phone: str(r, "sMobile", "sPhone"),
    accessCode: str(r, "sAccessCode", "sGateCode"),
    company: str(r, "sCompany"),
  };
}

export function mapLedger(r: Row): Ledger {
  return {
    ledgerId: num(r, "LedgerID", "iLedgerID"),
    unitId: num(r, "UnitID", "iUnitID"),
    unitName: str(r, "sUnitName"),
    rent: num(r, "dcRent", "dcRentAmount"),
    paidThrough: date(r, "dPaidThru", "dPaidThrough"),
    balance: num(r, "dcChargeBalance", "dcTotalDue", "dcBalance"),
    scheduledMoveOut: date(r, "dSchedOut", "dScheduledOut", "dMovedOutScheduled"),
    accessCode: str(r, "sAccessCode", "sGateCode"),
  };
}

export function mapBalance(r: Row): Balance {
  return {
    ledgerId: num(r, "LedgerID", "iLedgerID"),
    unitName: str(r, "sUnitName"),
    currentBalance: num(r, "dcBalance", "dcTotalBalance", "dcChargeBalance"),
    pastDue: num(r, "dcPastDue", "dcPastDueBalance", "dcAmountPastDue"),
    daysPastDue: num(r, "iDaysPastDue", "iDaysLate"),
  };
}

export function mapBillingInfo(rows: Row[]): BillingInfo {
  const r = rows[0];
  const autoBillType = num(r, "iAutoBillType");
  const cc = str(r, "sCreditCardNum", "sCCNumMasked", "sCreditCardNumber");
  const acct = str(r, "sAccountNum", "sACHAccountNum");
  const method = autoBillType === 0 && !bool(r, "bAutoBill") ? "None" : cc ? "Credit card" : acct ? "Bank account" : "On file";
  const lastFour = (cc || acct).replace(/\D/g, "").slice(-4);
  return {
    autopay: autoBillType > 0 || bool(r, "bAutoBill", "bAutoPay"),
    method,
    last4: lastFour.length === 4 ? lastFour : null,
    expires: date(r, "dCreditCardExpir", "dExpirationDate"),
  };
}

export function mapReservation(r: Row): Reservation {
  return {
    waitingId: num(r, "WaitingID", "iWaitingID"),
    tenantId: num(r, "TenantID", "iTenantID"),
    unitId: num(r, "UnitID", "iUnitID"),
    unitName: str(r, "sUnitName"),
    name: [str(r, "sFName", "sTenantFName"), str(r, "sLName", "sTenantLName")].filter(Boolean).join(" "),
    expires: date(r, "dExpires"),
    needed: date(r, "dNeeded"),
    quotedRate: num(r, "dcRate_Quoted", "dcQuotedRate"),
    status: num(r, "iStatus"),
    source: str(r, "sSource", "sInquirySource"),
  };
}

export function mapReports(pastDue: Row[], moves: Row[], occupancy: Row[], today: string): ReportSummary {
  const pastDueRows = pastDue.filter((r) => num(r, "dcPastDue", "dcAmount", "dcBalance", "PastDueBalance") > 0);
  const day = (r: Row, ...k: string[]) => (date(r, ...k) ?? "").slice(0, 10);
  const occ = occupancy[0];
  return {
    pastDueCount: pastDue.length ? pastDueRows.length : null,
    pastDueAmount: pastDue.length ? round(pastDueRows.reduce((s, r) => s + num(r, "dcPastDue", "dcAmount", "dcBalance", "PastDueBalance"), 0)) : null,
    moveInsToday: moves.length ? moves.filter((r) => /in/i.test(str(r, "sMoveType", "MoveType", "sType")) && day(r, "dDate", "dMoveIn", "MoveDate") === today).length : null,
    moveOutsToday: moves.length ? moves.filter((r) => /out/i.test(str(r, "sMoveType", "MoveType", "sType")) && day(r, "dDate", "dMoveOut", "MoveDate") === today).length : null,
    occupancyPct: occ ? optNum(occ, "dcUnitOccupancyPct", "dcOccupancyPct", "OccupancyPct") : null,
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
