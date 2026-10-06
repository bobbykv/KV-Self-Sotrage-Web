import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterGroups, fullTypes, groupUnits, sizeCategory } from "@/lib/catalog";
import { parseFaq, searchFaq } from "@/lib/faq";
import { halifaxDayBoundary, isPromoLive, promoMatches, promoStatus } from "@/lib/promotions";
import type { PriceListEntry, Unit } from "@/lib/sitelink/types";

function unit(p: Partial<Unit>): Unit {
  return {
    locationKey: "haley",
    unitId: 1,
    unitName: "A1",
    unitTypeId: 1,
    typeName: "Standard",
    widthFt: 10,
    lengthFt: 10,
    areaSqFt: 100,
    floor: null,
    climate: false,
    power: false,
    inside: false,
    alarm: false,
    vehicle: false,
    rate: 100,
    standardRate: 100,
    rented: false,
    rentable: true,
    excludedFromWebsite: false,
    waitingListReserved: false,
    description: "",
    ...p,
  };
}

describe("unit catalog", () => {
  it("groups identical units and picks the cheapest to hold", () => {
    const groups = groupUnits([unit({ unitId: 1, rate: 120 }), unit({ unitId: 2, rate: 95 }), unit({ unitId: 3, widthFt: 5, lengthFt: 5, rate: 40 })]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ widthFt: 5, available: 1 });
    expect(groups[1]).toMatchObject({ available: 2, fromRate: 95, bestUnitId: 2 });
  });

  it("does not merge across locations or climate", () => {
    const groups = groupUnits([unit({ unitId: 1 }), unit({ unitId: 2, locationKey: "hwy4" }), unit({ unitId: 3, climate: true })]);
    expect(groups).toHaveLength(3);
  });

  it("categorises sizes", () => {
    expect(sizeCategory({ vehicle: true, widthFt: 10, lengthFt: 30 })).toBe("parking");
    expect(sizeCategory({ vehicle: false, widthFt: 5, lengthFt: 10 })).toBe("small");
    expect(sizeCategory({ vehicle: false, widthFt: 10, lengthFt: 15 })).toBe("medium");
    expect(sizeCategory({ vehicle: false, widthFt: 10, lengthFt: 20 })).toBe("large");
  });

  it("filters groups", () => {
    const groups = groupUnits([unit({ unitId: 1, climate: true }), unit({ unitId: 2, locationKey: "stellarton", widthFt: 10, lengthFt: 20 })]);
    expect(filterGroups(groups, { climate: true })).toHaveLength(1);
    expect(filterGroups(groups, { location: "stellarton" })[0].locationKey).toBe("stellarton");
    expect(filterGroups(groups, { category: "large" })).toHaveLength(1);
  });

  it("lists sold-out types for lead capture", () => {
    const groups = groupUnits([unit({ unitId: 1 })]);
    const price = (p: Partial<PriceListEntry>) => ({ locationKey: "haley", unitTypeId: 1, typeName: "Standard", widthFt: 10, lengthFt: 10, climate: false, standardRate: 100, webRate: null, vacant: 0, total: 5, ...p }) as PriceListEntry;
    const full = fullTypes([price({}), price({ widthFt: 10, lengthFt: 30 })], groups);
    expect(full).toHaveLength(1);
    expect(full[0].lengthFt).toBe(30);
  });
});

describe("promotions", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const base = { active: true, startsAt: null, endsAt: null, locations: ["all"], placements: ["homepage"] };

  it("respects the active toggle and date window", () => {
    expect(isPromoLive(base, now)).toBe(true);
    expect(isPromoLive({ ...base, active: false }, now)).toBe(false);
    expect(promoStatus({ ...base, startsAt: new Date("2026-11-01") }, now)).toBe("scheduled");
    expect(promoStatus({ ...base, endsAt: new Date("2026-10-01") }, now)).toBe("ended");
  });

  it("matches placement and location", () => {
    expect(promoMatches(base, { placement: "homepage", location: "hwy4" })).toBe(true);
    expect(promoMatches(base, { placement: "checkout" })).toBe(false);
    expect(promoMatches({ ...base, locations: ["haley"] }, { location: "stellarton" })).toBe(false);
  });

  it("turns staff-picked dates into Halifax day boundaries", () => {
    expect(halifaxDayBoundary("2026-07-01", "start").toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(halifaxDayBoundary("2026-01-15", "end").toISOString()).toBe("2026-01-16T03:59:59.000Z");
  });
});

describe("FAQ", () => {
  const cats = parseFaq(readFileSync("agent-brain/faq.md", "utf8"));

  it("parses the canonical FAQ and strips private owner notes", () => {
    expect(cats.length).toBeGreaterThan(3);
    const all = cats.flatMap((c) => c.entries);
    expect(all.length).toBeGreaterThan(10);
    expect(all.some((e) => /OWNER:/.test(e.answer))).toBe(false);
  });

  it("finds answers by synonym", () => {
    expect(searchFaq(cats, "what time does the office close")[0]?.question).toMatch(/hours/i);
    expect(searchFaq(cats, "how does the noke app work").length).toBeGreaterThan(0);
  });

  it("rejects an FAQ with no questions", () => {
    expect(() => parseFaq("# Only a heading")).toThrow();
  });
});
