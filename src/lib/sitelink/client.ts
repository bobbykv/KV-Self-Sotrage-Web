import "server-only";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { assertSiteLinkConfig, env } from "../env";
import { log } from "../log";
import { countryForRegion } from "../regions";
import { recordCall } from "./budget";
import { SiteLinkSoapFault, num, str, type DataSet, type Row } from "./dataset";
import {
  AUTO_BILL_CREDIT_CARD,
  AUTO_BILL_ON_DAY_PAST_DUE,
  BILLING_FREQUENCY_DEFAULT,
  CHANNEL_TYPE_WEBSITE,
  INQUIRY_TYPE,
  PAY_METHOD_CREDIT_CARD,
  PAYMENT_SOURCE_WEBSITE,
  QT_RENTAL_TYPE_RESERVATION,
  RESERVATION_STATUS_OPEN,
  SITELINK_NONE_ID,
  SOURCE_WEBSITE,
  SOURCE_WEBSITE_LABEL,
} from "./enums";
import { matchingWinterPrepaidPlan, paidThroughDate } from "./concessions";
import { mapBalance, mapBillingInfo, mapDiscountPlans, mapLedger, mapMoveInCost, mapPriceList, mapReports, mapReservation, mapTenant, mapUnit, rowsOf } from "./mappers";
import type { DiscountPlansReport } from "./types";
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
          licenseKey: env.SITELINK_API_LICENSE_KEY,
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

function concessionOrNone(id: number | null | undefined): number {
  return id && id > 0 ? id : SITELINK_NONE_ID;
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

  async createTenant(
    loc: LocationKey,
    t: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      addr1?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      license?: string;
      licRegion?: string;
    },
  ) {
    const region = t.region?.trim() || "NS";
    const country = countryForRegion(region);
    const data = await call(loc, "TenantNewDetailed_v3", {
      sFName: t.firstName,
      sLName: t.lastName,
      sEmail: t.email,
      sPhone: t.phone,
      sMobile: t.phone,
      sAddr1: t.addr1 ?? "",
      sCity: t.city ?? "",
      sRegion: region,
      sPostalCode: t.postalCode ?? "",
      sCountry: country.country || "Canada",
      sLicense: t.license ?? "",
      sLicRegion: t.licRegion ?? "",
      sCountryCode: country.countryCode || "CA",
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

  /**
   * Writes the mailing address and driver's license onto an existing tenant
   * before move-in, so SiteLinkeSignCreateLeaseURL_v2 can print them.
   * TenantUpdate_v3 overwrites every field, so unchanged values are copied
   * from TenantInfoByTenantID first.
   */
  async updateTenantForLease(
    loc: LocationKey,
    tenantId: number,
    profile: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      addr1: string;
      city: string;
      region: string;
      postalCode: string;
      license: string;
      licRegion: string;
    },
  ) {
    const info = await this.tenantInfo(loc, tenantId);
    if (!info) throw new SiteLinkError("TenantUpdate_v3", 0, "Tenant record was not found");
    const raw = info.raw;
    const keep = (key: string) => str(raw, key);
    const flag = (key: string) => /^(true|1)$/i.test(str(raw, key));
    const country = countryForRegion(profile.region);
    await call(loc, "TenantUpdate_v3", {
      iTenantID: tenantId,
      sGateCode: keep("sGateCode") || keep("sAccessCode"),
      sWebPassword: keep("sWebPassword"),
      sMrMrs: keep("sMrMrs"),
      sFName: profile.firstName,
      sMI: keep("sMI"),
      sLName: profile.lastName,
      sCompany: keep("sCompany"),
      sAddr1: profile.addr1,
      sAddr2: keep("sAddr2"),
      sCity: profile.city,
      sRegion: profile.region,
      sPostalCode: profile.postalCode,
      sCountry: country.country || profile.region,
      sPhone: profile.phone,
      sMrMrsAlt: keep("sMrMrsAlt"),
      sFNameAlt: keep("sFNameAlt"),
      sMIAlt: keep("sMIAlt"),
      sLNameAlt: keep("sLNameAlt"),
      sAddr1Alt: keep("sAddr1Alt"),
      sAddr2Alt: keep("sAddr2Alt"),
      sCityAlt: keep("sCityAlt"),
      sRegionAlt: keep("sRegionAlt"),
      sPostalCodeAlt: keep("sPostalCodeAlt"),
      sCountryAlt: keep("sCountryAlt"),
      sPhoneAlt: keep("sPhoneAlt"),
      sMrMrsBus: keep("sMrMrsBus"),
      sFNameBus: keep("sFNameBus"),
      sMIBus: keep("sMIBus"),
      sLNameBus: keep("sLNameBus"),
      sCompanyBus: keep("sCompanyBus"),
      sAddr1Bus: keep("sAddr1Bus"),
      sAddr2Bus: keep("sAddr2Bus"),
      sCityBus: keep("sCityBus"),
      sRegionBus: keep("sRegionBus"),
      sPostalCodeBus: keep("sPostalCodeBus"),
      sCountryBus: keep("sCountryBus"),
      sPhoneBus: keep("sPhoneBus"),
      sFax: keep("sFax"),
      sEmail: profile.email,
      sPager: keep("sPager"),
      sMobile: profile.phone || keep("sMobile"),
      bCommercial: flag("bCommercial"),
      bCompanyIsTenant: flag("bCompanyIsTenant"),
      dDOB: keep("dDOB"),
      sTenNote: keep("sTenNote"),
      sLicense: profile.license,
      sLicRegion: profile.licRegion,
      sSSN: keep("sSSN"),
      sEmailAlt: keep("sEmailAlt"),
      sRelationshipAlt: keep("sRelationshipAlt"),
      sTaxID: keep("sTaxID"),
      bSMSOptIn: flag("bSMSOptIn"),
      sCountryCode: country.countryCode,
    });
  },

  /** Attaches a driver's license / government ID image to the tenant. Bytes are not logged. */
  async uploadTenantImage(loc: LocationKey, tenantId: number, imageBase64: string, fileName: string) {
    await call(loc, "TenantImageUpload", { iTenantID: tenantId, aryImageBytes: imageBase64, sFileName: fileName });
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
    r: { tenantId: number; unitId: number; needed: Date; expires: Date; quotedRate: number; comment: string; trackingCode: string; concessionId?: number | null },
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
      ConcessionID: concessionOrNone(r.concessionId),
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
    r: {
      waitingId: number;
      tenantId: number;
      unitId: number;
      needed: Date;
      expires: Date;
      quotedRate: number;
      comment: string;
      status?: number;
      cancellationTypeId?: number;
      cancellationReason?: string;
      concessionId?: number | null;
    },
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
      ConcessionID: concessionOrNone(r.concessionId),
    });
  },

  async reservationNote(loc: LocationKey, waitingId: number, note: string) {
    await call(loc, "ReservationNoteInsert", { WaitingID: waitingId, sNote: note });
  },

  /**
   * 28-day move-in quote (§10.47). Concession, insurance, promo, and a missing
   * waiting id are -999. Falls back to the calendar reservation quote only when
   * the 28-day method itself is unavailable.
   */
  async moveInCost(loc: LocationKey, q: { unitId: number; moveInDate: Date; waitingId?: number | null; concessionId?: number | null }) {
    const args = {
      iUnitID: q.unitId,
      dMoveInDate: q.moveInDate,
      InsuranceCoverageID: SITELINK_NONE_ID,
      ConcessionPlanID: concessionOrNone(q.concessionId),
      WaitingID: q.waitingId && q.waitingId > 0 ? q.waitingId : SITELINK_NONE_ID,
      bApplyInsuranceCredit: false,
      iPromoGlobalNum: SITELINK_NONE_ID,
      sCreditCardNum: "",
    };
    let data: DataSet;
    try {
      data = await call(loc, "MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", args);
    } catch (err) {
      if (err instanceof SiteLinkError) throw err;
      log.warn("28-day move-in cost method unavailable; using the calendar reservation quote", {
        location: loc,
        err: err instanceof SiteLinkSoapFault || err instanceof Error ? err.message : "unknown",
      });
      data = await call(loc, "MoveInCostRetrieveWithDiscount_Reservation_v4", args);
    }
    return mapMoveInCost(rowsOf(data, "Table"), env.HST_RATE);
  },

  /**
   * Live SiteLink discount plans. A failed call (including permission -95) returns
   * an empty list so checkout can continue on standard 28-day billing.
   * winterPlanId is set only when a returned plan matches the 6-month winter package.
   */
  async discountPlans(loc: LocationKey): Promise<DiscountPlansReport> {
    try {
      const data = await call(loc, "DiscountPlansRetrieve");
      const plans = mapDiscountPlans(data.ConcessionPlans ?? [], data.ConcessionUnitTypes ?? []);
      const winter = matchingWinterPrepaidPlan(plans.filter((p) => !p.disabled));
      return { plans, source: "sitelink", error: null, winterPlanId: winter?.concessionId ?? null };
    } catch (err) {
      log.warn("DiscountPlansRetrieve failed", { location: loc, err });
      return { plans: [], source: "unavailable", error: err instanceof Error ? err.message : "Discount plans unavailable", winterPlanId: null };
    }
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
      /** Paid-through date from MoveInCostRetrieve. Required for multi-period prepaid plans. */
      endDate?: Date | string | null;
      prepaidPeriods?: number;
      concessionId?: number | null;
      /** 0 card, 1 check, 2 cash. Cash and check send empty card fields. */
      payMethod?: number;
      amount: number;
      card: { typeId: number; number: string; cvv: string; expires: Date; name: string; street: string; postal: string };
    },
  ) {
    const data = await call(loc, "MoveInWithDiscount_v7", {
      TenantID: m.tenantId,
      sAccessCode: "",
      UnitID: m.unitId,
      dStartDate: m.startDate,
      dEndDate: m.endDate instanceof Date || typeof m.endDate === "string" ? m.endDate : paidThroughDate(m.startDate, null, m.prepaidPeriods ?? 1),
      dcPaymentAmount: m.amount,
      iCreditCardType: m.card.typeId,
      sCreditCardNumber: m.card.number,
      sCreditCardCVV: m.card.cvv,
      sCCTrack2: "",
      dExpirationDate: m.card.expires,
      sBillingName: m.card.name,
      sBillingAddress: m.card.street,
      sBillingZipCode: m.card.postal,
      InsuranceCoverageID: SITELINK_NONE_ID,
      ConcessionPlanID: concessionOrNone(m.concessionId),
      iSource: SOURCE_WEBSITE,
      sSource: SOURCE_WEBSITE_LABEL,
      bUsePushRate: false,
      iPayMethod: m.payMethod ?? PAY_METHOD_CREDIT_CARD,
      sABARoutingNum: "",
      sAccountNum: "",
      iAccountType: 0,
      iKeypadZoneID: 0,
      iTimeZoneID: 0,
      iBillingFrequency: BILLING_FREQUENCY_DEFAULT,
      WaitingID: m.waitingId > 0 ? m.waitingId : SITELINK_NONE_ID,
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

  /**
   * Stores the move-in card on the ledger and turns on credit-card auto bill
   * (§10.136). iAutoBillType 1 and iAutoBillOnDayPastDue 0 make SiteLink charge
   * that card every 28 days. The WSDL spells the expiration field dCredtiCardExpir.
   * Card values are not logged.
   */
  async enableAutoBillCard(
    loc: LocationKey,
    m: { ledgerId: number; cardTypeId: number; cardNumber: string; expires: Date; name: string; street: string; postal: string },
  ) {
    await this.updateTenantBilling(loc, {
      ledgerId: m.ledgerId,
      autoBill: true,
      card: { typeId: m.cardTypeId, number: m.cardNumber, expires: m.expires, name: m.name, street: m.street, postal: m.postal },
    });
  },

  /**
   * Saves or clears the card on a ledger (§10.136). iAutoBillType 1 with
   * iAutoBillOnDayPastDue 0 bills that card every 28 days. Card values are not logged.
   * The WSDL spells the expiration field dCredtiCardExpir.
   */
  async updateTenantBilling(
    loc: LocationKey,
    m: {
      ledgerId: number;
      autoBill: boolean;
      card?: { typeId: number; number: string; expires: Date; name: string; street: string; postal: string };
    },
  ) {
    const card = m.card;
    await call(loc, "TenantBillingInfoUpdate_v2", {
      iLedgerID: m.ledgerId,
      iCreditCardTypeID: card?.typeId ?? 0,
      sCreditCardNum: card?.number ?? "",
      dCredtiCardExpir: card?.expires ?? new Date("2099-12-31T00:00:00"),
      sCreditCardHolderName: card?.name ?? "",
      sCreditCardStreet: card?.street ?? "",
      sCreditCardZip: card?.postal ?? "",
      iAutoBillType: m.autoBill ? AUTO_BILL_CREDIT_CARD : 0,
      sACH_CheckWriterAcctNum: "",
      sACH_ABA_RoutingNum: "",
      sACH_Check_SavingsCode: "",
      iAutoBillOnDayPastDue: AUTO_BILL_ON_DAY_PAST_DUE,
    });
  },

  async scheduleMoveOut(loc: LocationKey, ledgerId: number, date: Date | null) {
    await call(loc, "ScheduleMoveOut", { iLedgerID: ledgerId, dScheduledOut: date ?? "" });
  },

  /**
   * Immediate move-out (§10.64). WSDL names are TenantID and UnitID.
   * Refuses to call SiteLink until SITELINK_USAGE_PASSWORD is set.
   */
  async moveOut(loc: LocationKey, tenantId: number, unitId: number) {
    const password = env.SITELINK_USAGE_PASSWORD;
    if (!password) throw new SiteLinkError("MoveOut", -1, "Set SITELINK_USAGE_PASSWORD to move a tenant out from the website.");
    const data = await call(loc, "MoveOut", { sUsagePassword: password, TenantID: tenantId, UnitID: unitId });
    const row = rowsOf(data, "RT")[0];
    return { ledgerId: retCode(data), refund: num(row, "dcRefund"), balance: num(row, "dcAcctBalance") };
  },

  /** Staff payment on an active ledger (§10.82). Pass the base amount; SiteLink adds surcharge. */
  async paymentSimpleCard(
    loc: LocationKey,
    m: {
      tenantId: number;
      unitId: number;
      amount: number;
      card: { typeId: number; number: string; cvv: string; expires: Date; name: string; street: string; postal: string };
    },
  ) {
    const data = await call(loc, "PaymentSimpleWithSource_v3", {
      iTenantID: m.tenantId,
      iUnitID: m.unitId,
      dcPaymentAmount: m.amount,
      iCreditCardType: m.card.typeId,
      sCreditCardNumber: m.card.number,
      sCreditCardCVV: m.card.cvv,
      sCCTrack2: "",
      dExpirationDate: m.card.expires,
      sBillingName: m.card.name,
      sBillingAddress: m.card.street,
      sBillingZipCode: m.card.postal,
      bTestMode: env.sitelinkTestMode,
      iSource: PAYMENT_SOURCE_WEBSITE,
    });
    return { receiptId: receiptIdOf(data) };
  },

  /** Cash payment (§10.77). */
  async paymentSimpleCash(loc: LocationKey, m: { tenantId: number; unitId: number; amount: number }) {
    const data = await call(loc, "PaymentSimpleCashWithSource", {
      iTenantID: m.tenantId,
      iUnitID: m.unitId,
      dcPaymentAmount: m.amount,
      iSource: PAYMENT_SOURCE_WEBSITE,
    });
    return { receiptId: receiptIdOf(data) };
  },

  /** Check or e-transfer. The reference goes in sCheckNumber (§10.79). */
  async paymentSimpleCheck(loc: LocationKey, m: { tenantId: number; unitId: number; amount: number; checkNumber: string }) {
    const data = await call(loc, "PaymentSimpleCheckWithSource", {
      iTenantID: m.tenantId,
      iUnitID: m.unitId,
      dcPaymentAmount: m.amount,
      sCheckNumber: m.checkNumber,
      iSource: PAYMENT_SOURCE_WEBSITE,
    });
    return { receiptId: receiptIdOf(data) };
  },

  /** Simulator only: zero a ledger balance after a portal card payment. */
  async clearLedgerBalance(loc: LocationKey, ledgerId: number) {
    if (env.sitelinkMode !== "mock" && !env.appTestMode) {
      throw new SiteLinkError("clearLedgerBalance", -1, "Balance payments via the website are only available in the simulator.");
    }
    const { applyMockBalancePayment } = await import("./mock");
    await applyMockBalancePayment(loc, ledgerId);
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

  /**
   * Reporting API — the nightly job and the dashboard "Run reports now" button only.
   * Move-ins and move-outs are requested from the first of the month through `day`
   * so the snapshot can show both today and month-to-date. Never call this per page view.
   */
  async dailyReports(loc: LocationKey, day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 0);
    const monthStart = new Date(start);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [pastDue, moves, occupancy] = await Promise.all([
      call(loc, "PastDueBalances", { dReportDateStart: start, dReportDateEnd: end }),
      call(loc, "MoveInsAndMoveOuts", { dReportDateStart: monthStart, dReportDateEnd: end }),
      call(loc, "OccupancyStatistics", { dReportDateStart: start, dReportDateEnd: end }),
    ]);
    return mapReports(rowsOf(pastDue, "Table"), rowsOf(moves, "Table"), rowsOf(occupancy, "Table"), day.toISOString().slice(0, 10));
  },
};

function receiptIdOf(data: DataSet): string | null {
  const row = data.Receipts?.[0] ?? rowsOf(data, "Receipts", "Table")[0];
  const id = str(row, "ReceiptID", "lngReceiptID", "iReceiptID");
  return id || (retCode(data) ? String(retCode(data)) : null);
}
