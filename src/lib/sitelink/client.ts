import "server-only";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { assertSiteLinkConfig, env } from "../env";
import { log } from "../log";
import { recordCall } from "./budget";
import { num, str, type DataSet, type Row } from "./dataset";
import {
  BILLING_FREQUENCY_DEFAULT,
  CHANNEL_TYPE_WEBSITE,
  INQUIRY_TYPE,
  PAY_METHOD_CREDIT_CARD,
  QT_RENTAL_TYPE_RESERVATION,
  RESERVATION_STATUS_OPEN,
  SOURCE_WEBSITE,
  SOURCE_WEBSITE_LABEL,
} from "./enums";
import { mapBalance, mapBillingInfo, mapLedger, mapMoveInCost, mapPriceList, mapReports, mapReservation, mapTenant, mapUnit, rowsOf } from "./mappers";
import { invokeMock } from "./mock";
import { assertOk, invokeLive, retCode, SiteLinkError, type Args, type SiteLinkMethod } from "./soap";

export { SiteLinkError };

async function call(locationKey: LocationKey, method: SiteLinkMethod, args: Args = {}): Promise<DataSet> {
  assertSiteLinkConfig();
  const started = Date.now();
  try {
    let data: DataSet;
    if (env.sitelinkMode === "mock" || env.appTestMode) {
      data = await invokeMock(method, locationKey, args);
      assertOk(method, data);
    } else {
      const code = env.sitelinkLocationCodes[locationKey];
      if (!code) throw new Error(`No SiteLink location code configured for ${locationKey}`);
      data = await invokeLive(
        {
          callCenterEndpoint: env.SITELINK_ENDPOINT,
          reportingEndpoint: env.SITELINK_REPORTING_ENDPOINT,
          corpCode: env.SITELINK_CORP_CODE!,
          username: env.SITELINK_API_USERNAME!,
          password: env.SITELINK_API_PASSWORD!,
          timeoutMs: env.SITELINK_TIMEOUT_MS,
        },
        method,
        code,
        args,
      );
    }
    void recordCall(locationKey, method, true);
    log.debug("sitelink call", { method, locationKey, ms: Date.now() - started });
    return data;
  } catch (err) {
    void recordCall(locationKey, method, false);
    log.warn("sitelink call failed", { method, locationKey, ms: Date.now() - started, err });
    throw err;
  }
}

/** .NET ticks (100ns since 0001-01-01) — the lngLastTimePolled format. */
export function dotNetTicks(d = new Date()): string {
  return (BigInt(d.getTime()) * 10000n + 621355968000000000n).toString();
}

function findPollTicks(data: DataSet): string | null {
  for (const rows of Object.values(data)) {
    for (const r of rows) if (r.lngLastTimePolled) return r.lngLastTimePolled;
  }
  return null;
}

export const sitelink = {
  locations: LOCATION_KEYS,
  mode: () => env.sitelinkMode,

  async availableUnits(loc: LocationKey, lastTimePolled = "0") {
    const pollStartedAt = dotNetTicks();
    const data = await call(loc, "UnitsInformationAvailableUnitsOnly_v2", { lngLastTimePolled: lastTimePolled });
    return {
      units: rowsOf(data, "Table").map((r) => mapUnit(loc, r)),
      lastTimePolled: findPollTicks(data) ?? pollStartedAt,
    };
  },

  async allUnits(loc: LocationKey) {
    const data = await call(loc, "UnitsInformation_v3", { lngLastTimePolled: "0", bReturnExcludedFromWebsiteUnits: true });
    return rowsOf(data, "Table").map((r) => mapUnit(loc, r));
  },

  async unitById(loc: LocationKey, unitId: number) {
    const data = await call(loc, "UnitsInformationByUnitID", { UnitID: unitId });
    const row = rowsOf(data, "Table")[0];
    return row ? mapUnit(loc, row) : null;
  },

  async priceList(loc: LocationKey) {
    const data = await call(loc, "UnitTypePriceList_v2");
    return rowsOf(data, "Table").map((r) => mapPriceList(loc, r));
  },

  /** Card-type ids are configured per site in SiteLink, so we look them up instead of hard-coding. */
  async paymentTypes(loc: LocationKey) {
    const data = await call(loc, "PaymentTypesRetrieve");
    return rowsOf(data, "Table").map((r) => ({ id: num(r, "PmtTypeID", "iPmtTypeID"), name: str(r, "sPmtTypeDesc", "sDesc"), isCard: str(r, "bCreditCard") !== "false" }));
  },

  async searchTenants(loc: LocationKey, q: { email?: string; lastName?: string; firstName?: string; phone?: string }) {
    const data = await call(loc, "TenantSearchDetailed", {
      sTenantFirstName: q.firstName ?? "",
      sTenantLastName: q.lastName ?? "",
      sEmailAddress: q.email ?? "",
      sPhoneNumber: q.phone ?? "",
    });
    return rowsOf(data, "Table").map(mapTenant);
  },

  async createTenant(loc: LocationKey, t: { firstName: string; lastName: string; email: string; phone: string }) {
    const data = await call(loc, "TenantNewDetailed_v3", {
      sFName: t.firstName,
      sLName: t.lastName,
      sEmail: t.email,
      sPhone: t.phone,
      sMobile: t.phone,
      sCountry: "Canada",
      sRegion: "NS",
      sCountryCode: "CA",
      bSMSOptIn: false,
      dDOB: null,
    });
    const id = retCode(data) || num(rowsOf(data, "Table")[0], "TenantID");
    if (!id) throw new SiteLinkError("TenantNewDetailed_v3", 0, "No TenantID returned");
    return id;
  },

  async findOrCreateTenant(loc: LocationKey, t: { firstName: string; lastName: string; email: string; phone: string }) {
    const existing = (await this.searchTenants(loc, { email: t.email })).find((x) => x.email.toLowerCase() === t.email.toLowerCase());
    if (existing) return { tenantId: existing.tenantId, created: false };
    return { tenantId: await this.createTenant(loc, t), created: true };
  },

  async setPortalPassword(loc: LocationKey, tenantId: number, email: string, password: string) {
    await call(loc, "TenantLoginAndSecurityUpdate", { TenantID: tenantId, sEmail: email, sWebPassword: password, sWebSecurityQ: "", sWebSecurityQA: "" });
  },

  async tenantLogin(loc: LocationKey, login: string, password: string): Promise<number | null> {
    try {
      const data = await call(loc, "TenantLogin", { sTenantLogin: login, sTenantPassword: password });
      return num(rowsOf(data, "Table")[0], "TenantID", "iTenantID") || retCode(data) || null;
    } catch (err) {
      if (err instanceof SiteLinkError) return null;
      throw err;
    }
  },

  async tenantInfo(loc: LocationKey, tenantId: number) {
    const data = await call(loc, "TenantInfoByTenantID", { iTenantID: tenantId });
    const row = rowsOf(data, "Table")[0];
    return row ? { tenant: mapTenant(row), raw: row } : null;
  },

  async tenantIdByUnitName(loc: LocationKey, unitName: string): Promise<number | null> {
    try {
      const data = await call(loc, "TenantIDByUnitNameOrAccessCode", { sUnitName: unitName, sAccessCode: "" });
      return num(rowsOf(data, "Table")[0], "TenantID", "iTenantID") || retCode(data) || null;
    } catch (err) {
      if (err instanceof SiteLinkError) return null;
      throw err;
    }
  },

  async ledgers(loc: LocationKey, tenantId: number) {
    const data = await call(loc, "LedgersByTenantID_v3", { sTenantID: String(tenantId) });
    const rows = rowsOf(data, "Table");
    return { ledgers: rows.map(mapLedger), raw: rows };
  },

  async balances(loc: LocationKey, tenantId: number) {
    const data = await call(loc, "CustomerAccountsBalanceDetails_v2", { iTenantID: tenantId });
    return rowsOf(data, "Table").map(mapBalance);
  },

  async billingInfo(loc: LocationKey, tenantId: number) {
    const data = await call(loc, "TenantBillingInfoByTenantID_v3", { iTenantID: tenantId });
    return mapBillingInfo(rowsOf(data, "Table"));
  },

  async createReservation(
    loc: LocationKey,
    r: { tenantId: number; unitId: number; needed: Date; expires: Date; quotedRate: number; comment: string; trackingCode: string },
  ): Promise<number> {
    const data = await call(loc, "ReservationNewWithSource_v5", {
      sTenantID: String(r.tenantId),
      sUnitID: String(r.unitId),
      dNeeded: r.needed,
      sComment: r.comment,
      iSource: SOURCE_WEBSITE,
      sSource: SOURCE_WEBSITE_LABEL,
      QTRentalTypeID: QT_RENTAL_TYPE_RESERVATION,
      iInquiryType: INQUIRY_TYPE,
      dcQuotedRate: r.quotedRate,
      dExpires: r.expires,
      dFollowUp: r.expires,
      sTrackingCode: r.trackingCode,
      sCallerID: "",
      ConcessionID: 0,
    });
    const waitingId = retCode(data) || num(rowsOf(data, "Table")[0], "WaitingID");
    if (!waitingId) throw new SiteLinkError("ReservationNewWithSource_v5", 0, "No WaitingID returned");
    return waitingId;
  },

  async reservation(loc: LocationKey, waitingId: number) {
    const data = await call(loc, "ReservationList_v3", { iGlobalWaitingNum: 0, WaitingID: waitingId });
    const row = rowsOf(data, "Table")[0];
    return row ? { reservation: mapReservation(row), raw: row } : null;
  },

  async reservations(loc: LocationKey) {
    const data = await call(loc, "ReservationList_v3", { iGlobalWaitingNum: 0, WaitingID: 0 });
    return rowsOf(data, "Table").map(mapReservation);
  },

  async updateReservation(
    loc: LocationKey,
    r: { waitingId: number; tenantId: number; unitId: number; needed: Date; expires: Date; quotedRate: number; comment: string; status?: number; cancellationTypeId?: number; cancellationReason?: string },
  ) {
    await call(loc, "ReservationUpdate_v4", {
      WaitingID: r.waitingId,
      sTenantID: String(r.tenantId),
      sUnitID: String(r.unitId),
      dNeeded: r.needed,
      sComment: r.comment,
      iStatus: r.status ?? RESERVATION_STATUS_OPEN,
      bFollowup: false,
      dFollowup: r.expires,
      dFollowupLast: new Date(),
      iInquiryType: INQUIRY_TYPE,
      dcQuotedRate: r.quotedRate,
      dExpires: r.expires,
      QTRentalTypeID: QT_RENTAL_TYPE_RESERVATION,
      QTCancellationTypeID: r.cancellationTypeId ?? 0,
      sCancellationReason: r.cancellationReason ?? "",
      ConcessionID: 0,
    });
  },

  async reservationNote(loc: LocationKey, waitingId: number, note: string) {
    await call(loc, "ReservationNoteInsert", { WaitingID: waitingId, sNote: note });
  },

  async moveInCost(loc: LocationKey, q: { unitId: number; moveInDate: Date; waitingId: number }) {
    const data = await call(loc, "MoveInCostRetrieveWithDiscount_Reservation_v4", {
      iUnitID: q.unitId,
      dMoveInDate: q.moveInDate,
      InsuranceCoverageID: 0,
      ConcessionPlanID: 0,
      WaitingID: q.waitingId,
      bApplyInsuranceCredit: false,
      iPromoGlobalNum: 0,
      sCreditCardNum: "",
    });
    return mapMoveInCost(rowsOf(data, "Table"), env.HST_RATE);
  },

  /**
   * PASS-THROUGH PAYMENT. Card fields arrive here from the server-only pay
   * route and go straight into the SOAP envelope. They are never returned,
   * logged (redact.ts strips them from any message) or persisted.
   */
  async moveInWithCard(
    loc: LocationKey,
    m: {
      tenantId: number;
      unitId: number;
      waitingId: number;
      startDate: Date;
      amount: number;
      card: { typeId: number; number: string; cvv: string; expires: Date; name: string; street: string; postal: string };
    },
  ) {
    const data = await call(loc, "MoveInWithDiscount_v7", {
      TenantID: m.tenantId,
      sAccessCode: "",
      UnitID: m.unitId,
      dStartDate: m.startDate,
      dEndDate: null,
      dcPaymentAmount: m.amount,
      iCreditCardType: m.card.typeId,
      sCreditCardNumber: m.card.number,
      sCreditCardCVV: m.card.cvv,
      sCCTrack2: "",
      dExpirationDate: m.card.expires,
      sBillingName: m.card.name,
      sBillingAddress: m.card.street,
      sBillingZipCode: m.card.postal,
      InsuranceCoverageID: 0,
      ConcessionPlanID: 0,
      iSource: SOURCE_WEBSITE,
      sSource: SOURCE_WEBSITE_LABEL,
      bUsePushRate: false,
      iPayMethod: PAY_METHOD_CREDIT_CARD,
      sABARoutingNum: "",
      sAccountNum: "",
      iAccountType: 0,
      iKeypadZoneID: 0,
      iTimeZoneID: 0,
      iBillingFrequency: BILLING_FREQUENCY_DEFAULT,
      WaitingID: m.waitingId,
      ChannelType: CHANNEL_TYPE_WEBSITE,
      bTestMode: env.sitelinkTestMode,
      bApplyInsuranceCredit: false,
    });
    const row: Row | undefined = rowsOf(data, "Table")[0];
    return {
      ledgerId: num(row, "LedgerID", "iLedgerID") || retCode(data),
      receiptRef: str(row, "lngReceiptID", "iReceiptID", "ReceiptID") || null,
    };
  },

  async scheduleMoveOut(loc: LocationKey, ledgerId: number, date: Date) {
    await call(loc, "ScheduleMoveOut", { iLedgerID: ledgerId, dScheduledOut: date });
  },

  async leaseUrl(loc: LocationKey, tenantId: number, ledgerId: number, returnUrl: string): Promise<string | null> {
    try {
      const data = await call(loc, "SiteLinkeSignCreateLeaseURL_v2", { iTenantID: tenantId, iLedgerID: ledgerId, sFormIdsCommaDelimited: "", sReturnUrl: returnUrl });
      const row = rowsOf(data, "Table")[0];
      const url = str(row, "sURL", "URL", "sLeaseURL") || (data.Result?.[0]?.value ?? "");
      return url || null;
    } catch (err) {
      if (err instanceof SiteLinkError) return null;
      throw err;
    }
  },

  /** Reporting API — after-hours / dashboard jobs only, never the public hot path. */
  async dailyReports(loc: LocationKey, day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 0);
    const [pastDue, moves, occupancy] = await Promise.all([
      call(loc, "PastDueBalances", { dReportDateStart: start, dReportDateEnd: end }),
      call(loc, "MoveInsAndMoveOuts", { dReportDateStart: start, dReportDateEnd: end }),
      call(loc, "OccupancyStatistics", { dReportDateStart: start, dReportDateEnd: end }),
    ]);
    return mapReports(rowsOf(pastDue, "Table"), rowsOf(moves, "Table"), rowsOf(occupancy, "Table"), day.toISOString().slice(0, 10));
  },
};
