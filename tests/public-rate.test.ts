import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sitelink/mock-store", () => {
  let payload: unknown = null;
  return {
    loadMockPayload: async () => payload,
    saveMockPayload: async (next: unknown) => {
      payload = structuredClone(next);
    },
  };
});
import { billedRentAmount, groupUnits, publicMonthlyRate, publishedRates, quotedStandardRate, standardRateDrift } from "@/lib/catalog";
import { bestMoveInPromo, MOCK_FIRST_MONTH_CONCESSION_ID, offerForUnit, promoOfferLabel } from "@/lib/sitelink/concessions";
import { initMockState, invokeMock, resetMockMemory } from "@/lib/sitelink/mock";
import type { ConcessionPlan } from "@/lib/sitelink/types";
import { mapPriceList, mapUnit } from "@/lib/sitelink/mappers";
import type { PriceListEntry, Unit } from "@/lib/sitelink/types";

function unit(partial: Partial<Unit>): Unit {
  return {
    locationKey: "hwy4",
    unitId: 1,
    unitName: "A1",
    unitTypeId: 1,
    typeName: "Drive-up",
    widthFt: 10,
    lengthFt: 10,
    areaSqFt: 100,
    floor: null,
    climate: false,
    power: false,
    inside: false,
    alarm: false,
    vehicle: false,
    rate: 124,
    standardRate: 140,
    rented: false,
    rentable: true,
    excludedFromWebsite: false,
    waitingListReserved: false,
    description: "",
    ...partial,
  };
}

describe("public price is the SiteLink standard rate", () => {
  it("shows Addington Forks standard rates and ignores the lower web rate", () => {
    const rows = [
      { width: "5", length: "10", std: "98.00", web: "85.00" },
      { width: "10", length: "10", std: "140.00", web: "124.00" },
      { width: "10", length: "15", std: "177.00", web: "159.00" },
    ].map((row, index) =>
      mapUnit("hwy4", {
        UnitID: String(index + 1),
        sUnitName: `A${index + 1}`,
        sTypeName: "Drive-up",
        dcWidth: row.width,
        dcLength: row.length,
        dcStdRate: row.std,
        dcWebRate: row.web,
        bRentable: "true",
        bRented: "false",
      }),
    );

    expect(rows.map((row) => row.rate)).toEqual([85, 124, 159]);
    expect(rows.map((row) => publicMonthlyRate(row))).toEqual([98, 140, 177]);
    expect(groupUnits(rows).map((group) => group.fromRate)).toEqual([98, 140, 177]);

    const prices = rows.map((row) =>
      mapPriceList("hwy4", {
        UnitTypeID: String(row.unitTypeId),
        sTypeName: row.typeName,
        dcWidth: String(row.widthFt),
        dcLength: String(row.lengthFt),
        dcStdRate: String(row.standardRate),
        dcWebRate: String(row.rate),
      }),
    );
    expect(publishedRates(prices).map((price) => price.fromRate)).toEqual([98, 140, 177]);
  });

  it("does not convert a standard rate into a 28-day amount", () => {
    const mapped = mapUnit("hwy4", {
      UnitID: "9",
      dcWidth: "10",
      dcLength: "10",
      dcStdRate: "140.00",
      dcWebRate: "124.00",
      sTypeName: "Drive-up",
    });
    expect(publicMonthlyRate(mapped)).toBe(140);
    expect(publicMonthlyRate(mapped)).not.toBeCloseTo((140 * 28) / 30, 1);
    expect(publicMonthlyRate({ standardRate: 0, webRate: 124 })).toBe(124);
  });
});

describe("the quoted rate is the standard rate", () => {
  it("sends dcStdRate, not the web rate", () => {
    expect(quotedStandardRate({ standardRate: 140, rate: 124, webRate: 124 })).toBe(140);
    expect(quotedStandardRate({ standardRate: 98, rate: 85 })).toBe(98);
    expect(quotedStandardRate({ standardRate: 177, rate: 159 })).toBe(177);
  });

  it("flags a SiteLink rent line that is not the standard rate, and stays quiet when a concession is a separate discount", () => {
    const drift = standardRateDrift(140, [{ kind: "rent", amount: 124 }]);
    expect(drift).toMatch(/\$124\.00/);
    expect(drift).toMatch(/\$140\.00/);
    expect(standardRateDrift(140, [{ kind: "rent", amount: 140 }, { kind: "discount", amount: -42 }, { kind: "fee", amount: 20 }])).toBeNull();
    expect(standardRateDrift(140, [{ kind: "rent", amount: 98 }, { kind: "discount", amount: -42 }])).toBeNull();
    expect(billedRentAmount([{ kind: "rent", amount: 140 }, { kind: "fee", amount: 20 }])).toBe(140);
  });

  it("still groups a unit by its standard rate when the web rate is lower", () => {
    const groups = groupUnits([unit({ unitId: 1, rate: 124, standardRate: 140 }), unit({ unitId: 2, rate: 110, standardRate: 140 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.fromRate).toBe(140);
  });
});

function promo(partial: Partial<ConcessionPlan>): ConcessionPlan {
  return {
    concessionId: MOCK_FIRST_MONTH_CONCESSION_ID,
    name: "30% off first month",
    description: "",
    comment: "",
    showOn: 1,
    prepay: false,
    prepaidMonths: 0,
    amountType: 1,
    chargeAmount: 0,
    fixedDiscount: 0,
    percentDiscount: 30,
    forAllUnits: true,
    disabled: false,
    applyAtMoveIn: true,
    unitTypes: [],
    ...partial,
  };
}

describe("SiteLink concessions are the promotion data", () => {
  beforeEach(() => {
    resetMockMemory();
  });

  it("labels a percent plan and would show it on a $140 unit", () => {
    const plan = promo({});
    expect(promoOfferLabel(plan)).toBe("30% off first month");
    expect(bestMoveInPromo([plan])).toMatchObject({ concessionId: MOCK_FIRST_MONTH_CONCESSION_ID });
    expect(offerForUnit([plan], { locationKey: "hwy4", typeName: "Drive-up", widthFt: 10, lengthFt: 10 })).toBe("30% off first month");
  });

  it("preserves a multi-month offer and its new-customer eligibility", () => {
    const name = "30% off first 3 months for new customers";
    expect(promoOfferLabel(promo({ name }))).toBe(name);
    expect(promoOfferLabel(promo({ name: "Concession 1" }))).toBe("30% off rent");
  });

  it("charges the standard rate and takes 30% off that rate, not the web rate", async () => {
    resetMockMemory();
    const st = initMockState();
    const unitRow = st.units.hwy4.find((row) => row.dcWidth === "10" && row.dcLength === "10" && row.sTypeName === "Drive-up")!;
    unitRow.dcStdRate = "140.00";
    unitRow.dcWebRate = "124.00";
    const store = await import("@/lib/sitelink/mock-store");
    await store.saveMockPayload(st);
    const plain = await invokeMock("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", "hwy4", {
      iUnitID: unitRow.UnitID,
      dMoveInDate: "2026-11-01T00:00:00",
      ConcessionPlanID: -999,
    });
    expect(plain.Table[0].ChargeAmount).toBe("140.00");
    expect(plain.Table[0].dcDiscount).toBe("0");
    const sale = await invokeMock("MoveInCostRetrieveWithDiscount_28DayBilling_Reservation_v4", "hwy4", {
      iUnitID: unitRow.UnitID,
      dMoveInDate: "2026-11-01T00:00:00",
      ConcessionPlanID: MOCK_FIRST_MONTH_CONCESSION_ID,
    });
    expect(sale.Table[0].ChargeAmount).toBe("140.00");
    expect(sale.Table[0].dcDiscount).toBe("42.00");
    expect(standardRateDrift(140, [{ kind: "rent", amount: 140 }, { kind: "discount", amount: -42 }])).toBeNull();
  });
});

describe("price list rows", () => {
  it("uses dcStdRate when both rate fields are present", () => {
    const entry: PriceListEntry = mapPriceList("hwy4", {
      sTypeName: "Drive-up",
      dcWidth: "10",
      dcLength: "10",
      dcStdRate: "140",
      dcWebRate: "124",
    });
    expect(entry.standardRate).toBe(140);
    expect(entry.webRate).toBe(124);
    expect(publicMonthlyRate(entry)).toBe(140);
  });
});
