import { describe, expect, it } from "vitest";
import { locationInventoryFromSnapshots, mergeUnits, openUnitCounts } from "@/lib/inventory";
import { publishedRates } from "@/lib/catalog";
import { SiteLinkError } from "@/lib/sitelink/soap";
import { isSiteLinkPermissionDenied } from "@/lib/holds";
import { mockPriceListFor, mockUnitsFor } from "@/lib/sitelink/mock";
import type { PriceListEntry, Unit } from "@/lib/sitelink/types";

const price: PriceListEntry = {
  locationKey: "haley",
  unitTypeId: 7,
  typeName: "Climate-controlled",
  widthFt: 5,
  lengthFt: 10,
  climate: true,
  standardRate: 110,
  webRate: 99,
  vacant: 3,
  total: 8,
};

describe("available snapshot merging", () => {
  const available: Unit = {
    ...mockUnitsFor("hwy4")[0],
    unitId: 42,
    rented: false,
    rentable: true,
    waitingListReserved: false,
    excludedFromWebsite: false,
  };

  it.each([
    { rented: true },
    { rentable: false },
    { waitingListReserved: true },
    { excludedFromWebsite: true },
  ])("removes unavailable units from full and delta snapshots: %j", (flags) => {
    const hidden = { ...available, ...flags };
    expect(mergeUnits([], [hidden])).toEqual([]);
    expect(mergeUnits([available], [hidden])).toEqual([]);
    expect(mergeUnits([hidden], [])).toEqual([]);
    expect(mergeUnits([hidden], [available])).toEqual([available]);
  });

  it("preserves untouched available units and replaces changed ones", () => {
    const untouched = { ...available, unitId: 43 };
    const changed = { ...available, standardRate: 200 };
    expect(mergeUnits([available, untouched], [changed])).toEqual([changed, untouched]);
  });
});

describe("live availability does not fall back to sample units", () => {
  it("shows published prices and no sample unit ids when SiteLink has never succeeded", () => {
    const demoIds = new Set(mockUnitsFor("haley").map((u) => u.unitId));
    const denied = locationInventoryFromSnapshots(
      "haley",
      { data: [], refreshedAt: new Date(0), lastError: "UnitsInformationAvailableUnitsOnly_v2: timed out before response headers" },
      { data: [price], refreshedAt: new Date("2026-11-01T12:00:00Z"), lastError: null },
      new Set(),
    );
    expect(denied.availability).toBe("published");
    expect(denied.units).toEqual([]);
    expect(denied.units.some((u) => demoIds.has(u.unitId))).toBe(false);
    expect(denied.priceList).toEqual([price]);
    expect(denied.lastError).toMatch(/timed out before response headers/);
    expect(denied.refreshedAt).toBeNull();
    expect(denied.pricesAsOf).toBe("2026-11-01T12:00:00.000Z");
    expect(publishedRates(denied.priceList).map((p) => p.fromRate)).toEqual([110]);
    expect(publishedRates(denied.priceList).every((p) => !("bestUnitId" in p) && !("unitId" in p))).toBe(true);
  });

  it("shows nothing bookable when both availability and the price list are missing", () => {
    const missing = locationInventoryFromSnapshots("stellarton", undefined, undefined, new Set());
    expect(missing.availability).toBe("none");
    expect(missing.units).toEqual([]);
    expect(missing.priceList).toEqual([]);
    expect(missing.lastError).toBe("Live availability is not loaded");
    expect(openUnitCounts([missing])).toBeUndefined();
  });

  it("hides a previous vacant-unit list after the latest pull fails", () => {
    const stale: Unit = { ...mockUnitsFor("hwy4")[0], unitId: 42, rate: 1, standardRate: 1 };
    const failed = locationInventoryFromSnapshots(
      "hwy4",
      { data: [stale], refreshedAt: new Date(), lastError: "HTTP 403 blocked cf-ray 8abc123def456-YHZ" },
      { data: [{ ...price, locationKey: "hwy4", webRate: 140, standardRate: 140 }], refreshedAt: new Date(), lastError: null },
      new Set(),
    );
    expect(failed.units.map((u) => u.unitId)).toEqual([]);
    expect(failed.availability).toBe("published");
    expect(failed.priceList[0]?.webRate).toBe(140);
  });

  it("keeps a successful live snapshot, including a genuinely empty one", () => {
    const live: Unit = { ...mockUnitsFor("hwy4")[0], unitId: 42, rate: 1, standardRate: 1 };
    const loaded = locationInventoryFromSnapshots("hwy4", { data: [live], refreshedAt: new Date(), lastError: null }, { data: [], refreshedAt: new Date() }, new Set());
    expect(loaded.availability).toBe("live");
    expect(loaded.units.map((u) => u.unitId)).toEqual([42]);
    expect(loaded.priceList).toEqual([]);

    const empty = locationInventoryFromSnapshots("hwy4", { data: [], refreshedAt: new Date(), lastError: null }, undefined, new Set());
    expect(empty.availability).toBe("live");
    expect(empty.units).toEqual([]);
    expect(openUnitCounts([empty])).toEqual({ hwy4: 0 });
  });
});

describe("sample units stay in explicit demo mode", () => {
  it("publishes the verified catalog only when allowDemo is set", () => {
    const denied = locationInventoryFromSnapshots(
      "hwy4",
      { data: [], refreshedAt: new Date(0), lastError: "UnitsInformationAvailableUnitsOnly_v2 failed (Ret_Code -95): denied" },
      { data: [], refreshedAt: new Date(0), lastError: "denied" },
      new Set(),
      { allowDemo: true },
    );
    expect(denied.availability).toBe("demo");
    expect(denied.units.map((u) => u.rate).filter((rate, i, all) => all.indexOf(rate) === i).sort((a, b) => a - b)).toEqual([98, 140, 177, 399]);
    expect(denied.priceList.map((p) => p.webRate).sort((a, b) => Number(a) - Number(b))).toEqual([98, 140, 177, 399]);
    expect(denied.units.filter((u) => u.rate === 98)).toHaveLength(4);
    expect(denied.units.filter((u) => u.rate === 140)).toHaveLength(9);
    expect(denied.units.filter((u) => u.rate === 177)).toHaveLength(4);
    expect(denied.lastError).toBeNull();
    expect(mockUnitsFor("stellarton").every((u) => u.rate !== 399)).toBe(true);
    expect(mockPriceListFor("haley").some((p) => p.climate)).toBe(true);
  });

  it("hides a catalog unit that already has a website hold", () => {
    const sample = mockUnitsFor("hwy4")[0];
    const hidden = locationInventoryFromSnapshots("hwy4", undefined, undefined, new Set([`hwy4:${sample.unitId}`]), { allowDemo: true });
    expect(hidden.units.some((u) => u.unitId === sample.unitId)).toBe(false);
  });
});

describe("SiteLink permission code", () => {
  it("treats SiteLink -95 as the permission toggle, not a vacant-unit failure", () => {
    expect(isSiteLinkPermissionDenied(new SiteLinkError("UnitsInformationByUnitID", -95, "denied"))).toBe(true);
    expect(isSiteLinkPermissionDenied(new SiteLinkError("UnitsInformationByUnitID", -1, "missing"))).toBe(false);
    expect(isSiteLinkPermissionDenied(new Error("Ret_Code -95"))).toBe(false);
  });
});
