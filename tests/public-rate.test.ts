import { describe, expect, it } from "vitest";
import { billedRentAmount, groupUnits, publicMonthlyRate, publishedRates, standardRateMismatch } from "@/lib/catalog";
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

describe("billing that differs from the shown price is flagged and left unchanged", () => {
  it("names the web-rate quote and the SiteLink rent charge without altering them", () => {
    const advertisedMonthly = 140;
    const quotedRate = 124;
    const billedRent = 124;
    const note = standardRateMismatch({ advertisedMonthly, quotedRate, billedRent });
    expect(note).toMatch(/\$140\.00 per month/);
    expect(note).toMatch(/\$124\.00/);
    expect(note).toMatch(/was not changed/);
    expect(note).toMatch(/amount due stays SiteLink's total/);
    expect(quotedRate).toBe(124);
    expect(billedRent).toBe(124);
    expect(standardRateMismatch({ advertisedMonthly: 140, quotedRate: 140, billedRent: 140 })).toBeNull();
    expect(billedRentAmount([{ kind: "rent", amount: 124 }, { kind: "fee", amount: 20 }])).toBe(124);
  });

  it("still groups a unit by its standard rate when the web rate is lower", () => {
    const groups = groupUnits([unit({ unitId: 1, rate: 124, standardRate: 140 }), unit({ unitId: 2, rate: 110, standardRate: 140 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.fromRate).toBe(140);
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
