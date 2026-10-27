import { beforeEach, describe, expect, it, vi } from "vitest";
import { cashSnapshot, openUnitsBySize, sizeKeyFor } from "@/lib/business-snapshot";
import {
  discountToggleKey,
  isWebEnabledPlan,
  planAppliesTo,
  planMatchesUnit,
  planShownOnWebsite,
  publicPlansForUnit,
} from "@/lib/sitelink/concessions";
import { mapReports } from "@/lib/sitelink/mappers";
import { initMockState, invokeMock, resetMockMemory, SIM_CARD_APPROVE } from "@/lib/sitelink/mock";
import { saveMockPayload } from "@/lib/sitelink/mock-store";
import { buildEnvelope } from "@/lib/sitelink/soap";
import type { ConcessionPlan, Unit } from "@/lib/sitelink/types";

vi.mock("@/lib/sitelink/mock-store", () => {
  let payload: unknown = null;
  return {
    loadMockPayload: async () => payload,
    saveMockPayload: async (next: unknown) => {
      payload = structuredClone(next);
    },
  };
});

const AUTH = { sCorpCode: "CORP", sLocationCode: "L001", sCorpUserName: "user", sCorpPassword: "secret" };

function plan(partial: Partial<ConcessionPlan> & Pick<ConcessionPlan, "concessionId" | "name">): ConcessionPlan {
  return {
    description: "",
    comment: "",
    showOn: 1,
    prepay: false,
    prepaidMonths: 0,
    amountType: 2,
    chargeAmount: 0,
    fixedDiscount: 0,
    percentDiscount: 0,
    forAllUnits: true,
    disabled: false,
    applyAtMoveIn: true,
    unitTypes: [],
    ...partial,
  };
}

function unit(partial: Partial<Unit> & Pick<Unit, "unitId" | "rate" | "rented" | "widthFt" | "lengthFt">): Unit {
  return {
    locationKey: "hwy4",
    unitName: String(partial.unitId),
    unitTypeId: 1,
    typeName: "Drive-up",
    areaSqFt: partial.widthFt * partial.lengthFt,
    floor: null,
    climate: false,
    power: false,
    inside: false,
    alarm: false,
    vehicle: false,
    standardRate: partial.rate,
    rentable: true,
    excludedFromWebsite: false,
    waitingListReserved: false,
    description: "",
    ...partial,
  };
}

describe("discount website toggles", () => {
  const driveUp = { typeName: "Drive-up", widthFt: 10, lengthFt: 10 };
  const web = plan({ concessionId: 10, name: "Web" });
  const paymentsOnly = plan({ concessionId: 11, name: "Payments", showOn: 2 });

  it("defaults web-enabled plans on and payments-only plans off", () => {
    expect(isWebEnabledPlan(web)).toBe(true);
    expect(isWebEnabledPlan(paymentsOnly)).toBe(false);
    expect(planShownOnWebsite(web, "hwy4", {})).toBe(true);
    expect(planShownOnWebsite(paymentsOnly, "hwy4", {})).toBe(false);
  });

  it("lets an explicit On show a payments-only plan that still matches the unit", () => {
    const toggles = { [discountToggleKey("hwy4", 11)]: true };
    expect(planAppliesTo(paymentsOnly, driveUp)).toBe(false);
    expect(planMatchesUnit(paymentsOnly, driveUp)).toBe(true);
    expect(planShownOnWebsite(paymentsOnly, "hwy4", toggles)).toBe(true);
    expect(publicPlansForUnit([paymentsOnly], driveUp, "hwy4", toggles).map((p) => p.concessionId)).toEqual([11]);
  });

  it("hides a web-enabled plan when staff turns it off", () => {
    const toggles = { [discountToggleKey("hwy4", 10)]: false };
    expect(planShownOnWebsite(web, "hwy4", toggles)).toBe(false);
    expect(publicPlansForUnit([web], driveUp, "hwy4", toggles)).toEqual([]);
  });
});

describe("staff SiteLink envelopes", () => {
  it("sends MoveOut with the usage password and WSDL id names", () => {
    const xml = buildEnvelope("MoveOut", AUTH, { sUsagePassword: "usage-secret", TenantID: 501, UnitID: 88 });
    expect(xml).toContain("<sUsagePassword>usage-secret</sUsagePassword>");
    expect(xml).toContain("<TenantID>501</TenantID>");
    expect(xml).toContain("<UnitID>88</UnitID>");
    expect(xml).not.toContain("iTenantID");
  });

  it("sends card, cash, and check payments with website source 10", () => {
    const card = buildEnvelope("PaymentSimpleWithSource_v3", AUTH, {
      iTenantID: 501,
      iUnitID: 88,
      dcPaymentAmount: 74.1,
      iCreditCardType: 6,
      sCreditCardNumber: "4242424242424242",
      sCreditCardCVV: "123",
      sCCTrack2: "",
      dExpirationDate: "2030-12-31T00:00:00",
      sBillingName: "Demo Tenant",
      sBillingAddress: "1 Main",
      sBillingZipCode: "B0H 1B0",
      bTestMode: true,
      iSource: 10,
    });
    expect(card).toContain("<iSource>10</iSource>");
    expect(card).toContain("<sCCTrack2></sCCTrack2>");
    const cash = buildEnvelope("PaymentSimpleCashWithSource", AUTH, { iTenantID: 501, iUnitID: 88, dcPaymentAmount: 20, iSource: 10 });
    expect(cash).toContain("<dcPaymentAmount>20.00</dcPaymentAmount>");
    expect(cash).not.toContain("sCheckNumber");
    const check = buildEnvelope("PaymentSimpleCheckWithSource", AUTH, {
      iTenantID: 501,
      iUnitID: 88,
      dcPaymentAmount: 20,
      sCheckNumber: "ET-100",
      iSource: 10,
    });
    expect(check).toContain("<sCheckNumber>ET-100</sCheckNumber>");
  });
});

describe("staff simulator", () => {
  beforeEach(async () => {
    resetMockMemory();
    await saveMockPayload(null);
  });

  it("rents a unit for cash without a card number", async () => {
    const state = initMockState();
    const vacant = state.units.hwy4.find((u) => u.bRented !== "true");
    expect(vacant).toBeTruthy();
    const result = await invokeMock("MoveInWithDiscount_v7", "hwy4", {
      iPayMethod: 2,
      sCreditCardNumber: "",
      UnitID: vacant!.UnitID,
      TenantID: 1,
      WaitingID: "",
      dEndDate: "2026-11-29T00:00:00",
    });
    expect(Number(result.RT?.[0]?.Ret_Code)).toBeGreaterThan(0);
    const after = await invokeMock("UnitsInformation_v3", "hwy4", {});
    const rented = after.Table?.find((u) => u.UnitID === vacant!.UnitID);
    expect(rented?.bRented).toBe("true");
  });

  it("moves a tenant out and unrents the unit", async () => {
    const state = initMockState();
    const ledger = state.ledgers.haley[0]!;
    const result = await invokeMock("MoveOut", "haley", { sUsagePassword: "secret", TenantID: ledger.TenantID, UnitID: ledger.UnitID });
    expect(result.RT?.[0]?.dcRefund).toBe("0");
    const ledgers = await invokeMock("LedgersByTenantID_v3", "haley", { sTenantID: String(ledger.TenantID) });
    expect(ledgers.Table ?? []).toHaveLength(0);
    const units = await invokeMock("UnitsInformation_v3", "haley", {});
    expect(units.Table?.find((u) => u.UnitID === String(ledger.UnitID))?.bRented).toBe("false");
  });

  it("takes a cash payment and returns a receipt", async () => {
    const state = initMockState();
    const ledger = state.ledgers.haley[0]!;
    const result = await invokeMock("PaymentSimpleCashWithSource", "haley", {
      iTenantID: ledger.TenantID,
      iUnitID: ledger.UnitID,
      dcPaymentAmount: 74.1,
      iSource: 10,
    });
    expect(result.Receipts?.[0]?.ReceiptID).toBeTruthy();
    const balances = await invokeMock("CustomerAccountsBalanceDetails_v2", "haley", { iTenantID: ledger.TenantID });
    const row = balances.Table?.find((r) => r.LedgerID === String(ledger.LedgerID) || r.sUnitName === ledger.sUnitName);
    expect(Number(row?.dcPastDue ?? row?.dcChargeBalance ?? 0)).toBe(0);
  });

  it("declines a card payment that is not the simulator approval number", async () => {
    const state = initMockState();
    const ledger = state.ledgers.haley[0]!;
    const declined = await invokeMock("PaymentSimpleWithSource_v3", "haley", {
      iTenantID: ledger.TenantID,
      iUnitID: ledger.UnitID,
      dcPaymentAmount: 10,
      sCreditCardNumber: "4000000000000002",
      iSource: 10,
    });
    expect(Number(declined.RT?.[0]?.Ret_Code)).toBeLessThan(0);
    const approved = await invokeMock("PaymentSimpleWithSource_v3", "haley", {
      iTenantID: ledger.TenantID,
      iUnitID: ledger.UnitID,
      dcPaymentAmount: 10,
      sCreditCardNumber: SIM_CARD_APPROVE,
      iSource: 10,
    });
    expect(approved.Receipts?.[0]?.ReceiptID).toBeTruthy();
  });
});

describe("daily snapshot math", () => {
  it("rolls occupied rent, potential gross, and vacant value from cached units", () => {
    const units = [
      unit({ unitId: 1, widthFt: 5, lengthFt: 10, rate: 98, rented: true }),
      unit({ unitId: 2, widthFt: 5, lengthFt: 10, rate: 98, rented: false }),
      unit({ unitId: 3, widthFt: 10, lengthFt: 10, rate: 140, rented: false }),
      unit({ unitId: 4, widthFt: 12, lengthFt: 40, rate: 399, rented: false, vehicle: true, typeName: "Outdoor Vehicle" }),
    ];
    const cash = cashSnapshot(units);
    expect(cash.rentRoll).toBe(98);
    expect(cash.potential).toBe(98 + 98 + 140 + 399);
    expect(cash.vacantValue).toBe(98 + 140 + 399);
    expect(cash.economicOccupancyPct).toBe(Math.round((98 / cash.potential) * 1000) / 10);
    const sizes = openUnitsBySize(units);
    expect(sizes.find((s) => s.key === "5x10")).toMatchObject({ vacant: 1, total: 2, rateMin: 98 });
    expect(sizes.find((s) => s.key === "outdoor")).toMatchObject({ vacant: 1, total: 1, rateMin: 399 });
    expect(sizeKeyFor(units[3]!)).toBe("outdoor");
  });

  it("counts today's moves and the rest of the month from one report", () => {
    const summary = mapReports(
      [{ dcPastDue: "40" }, { dcPastDue: "0" }],
      [
        { sMoveType: "Move In", dDate: "2026-10-27" },
        { sMoveType: "Move In", dDate: "2026-10-02" },
        { sMoveType: "Move Out", dDate: "2026-10-27" },
      ],
      [{ dcUnitOccupancyPct: "80" }],
      "2026-10-27",
    );
    expect(summary.pastDueCount).toBe(1);
    expect(summary.pastDueAmount).toBe(40);
    expect(summary.moveInsToday).toBe(1);
    expect(summary.moveOutsToday).toBe(1);
    expect(summary.moveInsMonth).toBe(2);
    expect(summary.moveOutsMonth).toBe(1);
  });
});
