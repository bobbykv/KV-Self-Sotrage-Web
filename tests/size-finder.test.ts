import { describe, expect, it } from "vitest";
import { areaRangeFromParams, filterFullTypes, filterGroups, groupUnits, type UnitFilter } from "@/lib/catalog";
import { sizeFinderHref, type SizeFinderAnswer } from "@/lib/size-finder";
import type { PriceListEntry, Unit } from "@/lib/sitelink/types";

function filterFor(answer: SizeFinderAnswer): UnitFilter {
  const sp = Object.fromEntries(new URL(sizeFinderHref(answer), "https://example.com").searchParams);
  return { ...areaRangeFromParams(sp), location: sp.location as UnitFilter["location"], climate: sp.climate === "1", category: sp.size as UnitFilter["category"] };
}

function unit(unitId: number, widthFt: number, lengthFt: number, options: Partial<Unit> = {}): Unit {
  return { locationKey: "haley", unitId, unitName: `A${unitId}`, unitTypeId: 1, typeName: "Standard", widthFt, lengthFt, areaSqFt: widthFt * lengthFt, floor: null, climate: false, power: false, inside: false, alarm: false, vehicle: false, rate: 100, standardRate: 100, rented: false, rentable: true, excludedFromWebsite: false, waitingListReserved: false, description: "", ...options };
}

const sizes = groupUnits([unit(1, 5, 5), unit(2, 5, 10), unit(3, 10, 10), unit(4, 10, 15), unit(5, 10, 20), unit(6, 10, 30)]);

describe("size finder to listing journey", () => {
  it("includes both advertised apartment sizes across small and medium categories", () => {
    expect(filterGroups(sizes, filterFor({ what: "apt1" })).map((g) => [g.widthFt, g.lengthFt])).toEqual([[5, 10], [10, 10]]);
  });

  it("includes 10x15 and 10x20 for a two- to three-bedroom home", () => {
    expect(filterGroups(sizes, filterFor({ what: "home2" })).map((g) => g.lengthFt)).toEqual([15, 20]);
  });

  it.each(["hwy4", "stellarton", "haley", ""] as const)("routes climate control to confirmed Haley storage when preference is %s", (location) => {
    const filter = filterFor({ what: "apt1", sensitive: true, location });
    expect(filter).toMatchObject({ location: "haley", climate: true });
    const choices = groupUnits([unit(1, 5, 10, { climate: true }), unit(2, 10, 10, { locationKey: "stellarton", climate: true }), unit(3, 10, 10)]);
    expect(filterGroups(choices, filter).map((g) => g.bestUnitId)).toEqual([1]);
  });

  it("keeps the preferred location when comparing without climate control", () => {
    expect(filterFor({ what: "apt1", sensitive: false, location: "stellarton" })).toMatchObject({ location: "stellarton", climate: false });
  });

  it("does not apply climate control or household area bounds to vehicle searches", () => {
    expect(sizeFinderHref({ what: "vehicle", sensitive: true, location: "haley" })).toBe("/units?size=parking&location=haley");
  });

  it("shows sold-out types that match the same size and location filters", () => {
    const price = (lengthFt: number, locationKey: PriceListEntry["locationKey"] = "haley"): PriceListEntry => ({ locationKey, unitTypeId: lengthFt, typeName: "Standard", widthFt: 10, lengthFt, climate: false, standardRate: 100, webRate: null, vacant: 0, total: 5 });
    const full = [price(10), price(15), price(20), price(30), price(20, "stellarton")];
    expect(filterFullTypes(full, filterFor({ what: "home2", location: "haley" })).map((p) => p.lengthFt)).toEqual([15, 20]);
    expect(filterFullTypes(full, { category: "medium", location: "haley" }).map((p) => p.lengthFt)).toEqual([10, 15]);
  });

  it("ignores invalid range values", () => {
    expect(areaRangeFromParams({ minArea: "-50", maxArea: "Infinity" })).toEqual({ minArea: undefined, maxArea: undefined });
  });
});
