import { describe, expect, it } from "vitest";
import { locationInventoryFromSnapshots } from "@/lib/inventory";
import { SiteLinkError } from "@/lib/sitelink/soap";
import { isSiteLinkPermissionDenied } from "@/lib/holds";
import { mockPriceListFor, mockUnitsFor } from "@/lib/sitelink/mock";
import type { Unit } from "@/lib/sitelink/types";

describe("verified catalog fallback", () => {
  it("publishes Exit 31 rates when SiteLink has never succeeded", () => {
    const denied = locationInventoryFromSnapshots(
      "hwy4",
      { data: [], refreshedAt: new Date(0), lastError: "UnitsInformationAvailableUnitsOnly_v2 failed (Ret_Code -95): denied" },
      { data: [], refreshedAt: new Date(0), lastError: "denied" },
      new Set(),
    );
    expect(denied.units.map((u) => u.rate).filter((rate, i, all) => all.indexOf(rate) === i).sort((a, b) => a - b)).toEqual([98, 140, 177, 399]);
    expect(denied.priceList.map((p) => p.webRate).sort((a, b) => Number(a) - Number(b))).toEqual([98, 140, 177, 399]);
    expect(denied.units.filter((u) => u.rate === 98)).toHaveLength(4);
    expect(denied.units.filter((u) => u.rate === 140)).toHaveLength(9);
    expect(denied.units.filter((u) => u.rate === 177)).toHaveLength(4);
    expect(denied.lastError).toBeNull();
    expect(mockUnitsFor("stellarton").every((u) => u.rate !== 399)).toBe(true);
    expect(mockPriceListFor("haley").some((p) => p.climate)).toBe(true);
  });

  it("uses a missing snapshot and an empty error the same way", () => {
    const missing = locationInventoryFromSnapshots("stellarton", undefined, undefined, new Set());
    expect(missing.units.length).toBeGreaterThan(0);
    expect(missing.priceList.length).toBeGreaterThan(0);
  });

  it("keeps a successful live snapshot, including a genuinely empty one", () => {
    const live: Unit = { ...mockUnitsFor("hwy4")[0], unitId: 42, rate: 1, standardRate: 1 };
    const loaded = locationInventoryFromSnapshots("hwy4", { data: [live], refreshedAt: new Date(), lastError: null }, { data: [], refreshedAt: new Date() }, new Set());
    expect(loaded.units.map((u) => u.unitId)).toEqual([42]);
    expect(loaded.priceList).toEqual([]);

    const empty = locationInventoryFromSnapshots("hwy4", { data: [], refreshedAt: new Date(), lastError: null }, undefined, new Set());
    expect(empty.units).toEqual([]);
  });

  it("hides a catalog unit that already has a website hold", () => {
    const sample = mockUnitsFor("hwy4")[0];
    const hidden = locationInventoryFromSnapshots("hwy4", undefined, undefined, new Set([`hwy4:${sample.unitId}`]));
    expect(hidden.units.some((u) => u.unitId === sample.unitId)).toBe(false);
  });

  it("treats SiteLink -95 as the permission toggle, not a vacant-unit failure", () => {
    expect(isSiteLinkPermissionDenied(new SiteLinkError("UnitsInformationByUnitID", -95, "denied"))).toBe(true);
    expect(isSiteLinkPermissionDenied(new SiteLinkError("UnitsInformationByUnitID", -1, "missing"))).toBe(false);
    expect(isSiteLinkPermissionDenied(new Error("Ret_Code -95"))).toBe(false);
  });
});
