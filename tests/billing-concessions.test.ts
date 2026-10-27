import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBillingDays, BILLING_PERIOD_DAYS, isWinterPrepaidPlan, matchingWinterPrepaidPlan, MOCK_WINTER_CONCESSION_ID, planAppliesTo, plansForUnit } from "@/lib/sitelink/concessions";
import { mapDiscountPlans, mapMoveInCost } from "@/lib/sitelink/mappers";
import { initMockState, invokeMock, resetMockMemory } from "@/lib/sitelink/mock";
import { buildEnvelope } from "@/lib/sitelink/soap";
import type { ConcessionPlan } from "@/lib/sitelink/types";

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
    forAllUnits: false,
    disabled: false,
    applyAtMoveIn: true,
    unitTypes: [],
    ...partial,
  };
}

describe("28-day billing contract", () => {
  it("defaults iBillingFrequency to 7 when the env override is unset", async () => {
    const prev = process.env.SITELINK_BILLING_FREQUENCY;
    delete process.env.SITELINK_BILLING_FREQUENCY;
    vi.resetModules();
    const enums = await import("@/lib/sitelink/enums");
    expect(enums.BILLING_FREQUENCY_DEFAULT).toBe(7);
    expect(enums.SITELINK_NONE_ID).toBe(-999);
    if (prev === undefined) delete process.env.SITELINK_BILLING_FREQUENCY;
    else process.env.SITELINK_BILLING_FREQUENCY = prev;
  });

  it("sends -999 sentinels and the 28-day cost method", () => {
    const xml = buildEnvelope("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", AUTH, {
      iUnitID: 1001,
      dMoveInDate: "2026-11-01T00:00:00",
      InsuranceCoverageID: -999,
      ConcessionPlanID: -999,
      WaitingID: 55,
      iPromoGlobalNum: -999,
    });
    expect(xml).toContain("<ConcessionPlanID>-999</ConcessionPlanID>");
    expect(xml).toContain("<InsuranceCoverageID>-999</InsuranceCoverageID>");
    expect(xml).toContain("<iPromoGlobalNum>-999</iPromoGlobalNum>");
    expect(xml).toContain("<WaitingID>55</WaitingID>");
  });

  it("passes concession, billing frequency 7, and the cost end date into move-in", () => {
    const xml = buildEnvelope("MoveInWithDiscount_v7", AUTH, {
      ConcessionPlanID: 39906,
      iBillingFrequency: 7,
      InsuranceCoverageID: -999,
      dStartDate: "2026-11-01T00:00:00",
      dEndDate: "2027-04-18T00:00:00",
      WaitingID: 55,
    });
    expect(xml).toContain("<iBillingFrequency>7</iBillingFrequency>");
    expect(xml).toContain("<ConcessionPlanID>39906</ConcessionPlanID>");
    expect(xml).toContain("<dStartDate>2026-11-01T00:00:00</dStartDate>");
    expect(xml).toContain("<dEndDate>2027-04-18T00:00:00</dEndDate>");
  });

  it("turns on credit-card auto bill with the WSDL expiration field", () => {
    const xml = buildEnvelope("TenantBillingInfoUpdate_v2", AUTH, {
      iLedgerID: 900,
      iCreditCardTypeID: 6,
      sCreditCardNum: "4242424242424242",
      dCredtiCardExpir: "2028-04-30T00:00:00",
      iAutoBillType: 1,
      iAutoBillOnDayPastDue: 0,
    });
    expect(xml).toContain("<dCredtiCardExpir>2028-04-30T00:00:00</dCredtiCardExpir>");
    expect(xml).toContain("<iAutoBillType>1</iAutoBillType>");
    expect(xml).toContain("<iAutoBillOnDayPastDue>0</iAutoBillOnDayPastDue>");
    expect(xml).not.toContain("<dCreditCardExpir>");
  });
});

describe("concession plan matching", () => {
  const winter = plan({
    concessionId: MOCK_WINTER_CONCESSION_ID,
    name: "$399 6-Month Winter Outdoor Storage Package",
    description: "Prepaid 6-period winter outdoor storage",
    prepay: true,
    prepaidMonths: 6,
    chargeAmount: 399,
    unitTypes: [{ unitTypeId: 9, widthFt: 12, lengthFt: 40, typeName: "Outdoor Vehicle, RV & Boat Winter Storage" }],
  });
  const percent = plan({ concessionId: 12, name: "10% off first period", prepay: false, amountType: 1, percentDiscount: 10, forAllUnits: true });

  it("recognizes a live 6-month prepaid winter plan and ignores ordinary discounts", () => {
    expect(isWinterPrepaidPlan(winter)).toBe(true);
    expect(isWinterPrepaidPlan(percent)).toBe(false);
    expect(matchingWinterPrepaidPlan([percent, winter])?.concessionId).toBe(MOCK_WINTER_CONCESSION_ID);
    expect(matchingWinterPrepaidPlan([percent])).toBeNull();
  });

  it("limits the winter package to outdoor parking units", () => {
    const outdoor = { unitTypeId: 9, typeName: "Outdoor Vehicle, RV & Boat Winter Storage", widthFt: 12, lengthFt: 40 };
    const driveUp = { unitTypeId: 3, typeName: "Drive-up", widthFt: 10, lengthFt: 10 };
    expect(planAppliesTo(winter, outdoor)).toBe(true);
    expect(planAppliesTo(winter, driveUp)).toBe(false);
    expect(plansForUnit([winter, percent], driveUp).map((p) => p.concessionId)).toEqual([12]);
    expect(plansForUnit([winter], outdoor)).toHaveLength(1);
  });

  it("uses a type-id-only winter plan on the winter unit", () => {
    const typeOnly = plan({
      ...winter,
      unitTypes: [{ unitTypeId: 44, widthFt: 0, lengthFt: 0, typeName: "" }],
    });
    expect(planAppliesTo(typeOnly, { typeName: "Outdoor Vehicle, RV & Boat Winter Storage", widthFt: 12, lengthFt: 40 })).toBe(true);
    expect(planAppliesTo(typeOnly, { typeName: "Drive-up", widthFt: 5, lengthFt: 10 })).toBe(false);
  });

  it("maps ConcessionPlans and ConcessionUnitTypes", () => {
    const mapped = mapDiscountPlans(
      [{ ConcessionID: "39906", sPlanName: "Winter", sDescription: "6 month", bPrepay: "true", iPrePaidMonths: "6", iAmtType: "2", dcChgAmt: "399", iShowOn: "1" }],
      [{ ConcessionID: "39906", UnitTypeID: "9", dcWidth: "12", dcLength: "40", sTypeName: "Outdoor" }],
    );
    expect(mapped[0]).toMatchObject({ concessionId: 39906, prepay: true, prepaidMonths: 6, chargeAmount: 399 });
    expect(mapped[0].unitTypes[0]).toMatchObject({ unitTypeId: 9, widthFt: 12, lengthFt: 40, typeName: "Outdoor" });
  });
});

describe("mock discount plans and 28-day cost", () => {
  beforeEach(() => {
    resetMockMemory();
  });

  it("returns the Exit 31 $399 6-month plan and no plans at the other sites", async () => {
    const hwy = await invokeMock("DiscountPlansRetrieve", "hwy4", {});
    const mapped = mapDiscountPlans(hwy.ConcessionPlans ?? [], hwy.ConcessionUnitTypes ?? []);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({ concessionId: MOCK_WINTER_CONCESSION_ID, prepay: true, prepaidMonths: 6, chargeAmount: 399 });
    expect(mapped[0].name).toMatch(/\$399 6-Month Winter/);
    const stel = await invokeMock("DiscountPlansRetrieve", "stellarton", {});
    const haley = await invokeMock("DiscountPlansRetrieve", "haley", {});
    expect(stel.ConcessionPlans ?? []).toHaveLength(0);
    expect(haley.ConcessionPlans ?? []).toHaveLength(0);
  });

  it("quotes one 28-day period without a concession and 168 days for the winter package", async () => {
    const st = initMockState();
    const winter = st.units.hwy4.find((u) => /winter storage/i.test(u.sTypeName))!;
    const driveUp = st.units.hwy4.find((u) => u.sTypeName === "Drive-up" && u.dcWidth === "5")!;
    const start = "2026-11-01T00:00:00";

    const standard = await invokeMock("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", "hwy4", {
      iUnitID: driveUp.UnitID,
      dMoveInDate: start,
      ConcessionPlanID: -999,
    });
    const standardCost = mapMoveInCost(standard.Table, 0.14);
    expect(standard.Table[0].ChargeDescription).toBe("Rent (28-day period)");
    expect(standard.Table[0].ChargeAmount).toBe("98.00");
    expect(standard.Table[0].EndDate).toBe(addBillingDays(start, BILLING_PERIOD_DAYS));
    expect(standardCost.total).toBeCloseTo(98 * 1.14 + 22.8, 2);

    const prepaid = await invokeMock("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", "hwy4", {
      iUnitID: winter.UnitID,
      dMoveInDate: start,
      ConcessionPlanID: MOCK_WINTER_CONCESSION_ID,
    });
    const prepaidCost = mapMoveInCost(prepaid.Table, 0.14);
    expect(prepaid.Table).toHaveLength(1);
    expect(prepaid.Table[0].ChargeAmount).toBe("399.00");
    expect(prepaid.Table[0].EndDate).toBe(addBillingDays(start, 6 * BILLING_PERIOD_DAYS));
    expect(prepaid.Table[0].EndDate).toBe("2027-04-18T00:00:00");
    expect(prepaidCost.endDate).toBe("2027-04-18T00:00:00");
    expect(prepaidCost.startDate).toBe(start);
    expect(prepaidCost.total).toBeCloseTo(399 * 1.14, 2);

    const rejected = await invokeMock("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", "hwy4", {
      iUnitID: driveUp.UnitID,
      dMoveInDate: start,
      ConcessionPlanID: MOCK_WINTER_CONCESSION_ID,
    });
    expect(Number(rejected.RT[0].Ret_Code)).toBe(-2);
  });

  it("saves auto bill on the ledger without keeping the card number", async () => {
    const saved = await invokeMock("TenantBillingInfoUpdate_v2", "haley", {
      iLedgerID: 9001,
      iAutoBillType: 1,
      sCreditCardNum: "4242424242424242",
      iAutoBillOnDayPastDue: 0,
    });
    expect(Number(saved.RT[0].Ret_Code)).toBe(9001);
    const info = await invokeMock("TenantBillingInfoByTenantID_v3", "haley", { iTenantID: 501 });
    expect(info.Table[0].iAutoBillType).toBe("1");
    expect(JSON.stringify(saved)).not.toContain("4242424242424242");
    const missing = await invokeMock("TenantBillingInfoUpdate_v2", "hwy4", { iLedgerID: 1, iAutoBillType: 1, sCreditCardNum: "4242424242424242" });
    expect(Number(missing.RT[0].Ret_Code)).toBe(-1);
  });
});
