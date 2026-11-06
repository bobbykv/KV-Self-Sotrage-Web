import { describe, expect, it } from "vitest";
import { fullTypes, groupUnits, publishedRates, storageTypeLabel } from "@/lib/catalog";
import { mergeUnits, locationInventoryFromSnapshots } from "@/lib/inventory";
import { mockUnitsFor } from "@/lib/sitelink/mock";
import type { PriceListEntry } from "@/lib/sitelink/types";

const unit = { ...mockUnitsFor("hwy4")[0], unitId: 42, widthFt: 5, lengthFt: 10, standardRate: 98, rate: 98, rented: false, rentable: true, waitingListReserved: false, excludedFromWebsite: false };
const price: PriceListEntry = { locationKey: "hwy4", unitTypeId: 1, typeName: "Drive-up", widthFt: 10, lengthFt: 20, climate: false, standardRate: 200, webRate: null, vacant: 0, total: 10 };

describe("public catalogue safety", () => {
  it.each([{ widthFt: 0 }, { lengthFt: 0 }, { widthFt: NaN }, { standardRate: 0, rate: 0 }, { unitId: 0 }])("hides malformed units from old snapshots, new snapshots and groups: %j", (fields) => {
    const invalid = { ...unit, ...fields };
    expect(groupUnits([invalid])).toEqual([]);
    expect(mergeUnits([], [invalid])).toEqual([]);
    expect(mergeUnits([{ ...unit, unitId: invalid.unitId }], [invalid])).toEqual([]);
    expect(mergeUnits([invalid], [])).toEqual([]);
    const inventory = locationInventoryFromSnapshots("hwy4", { data: [invalid], refreshedAt: new Date() }, undefined, new Set());
    expect(inventory.units).toEqual([]);
  });
  it("keeps valid rates unchanged and rejects zero-size price rows", () => {
    expect(groupUnits([unit])[0].fromRate).toBe(98);
    expect(publishedRates([{ ...price, widthFt: 0 }])).toEqual([]);
    expect(fullTypes([{ ...price, lengthFt: 0 }], [])).toEqual([]);
    expect(fullTypes([price], [])[0].standardRate).toBe(200);
  });
  it("shows storage features when the SiteLink type is a facility name", () => {
    expect(storageTypeLabel({ ...unit, typeName: "Addington Forks (2784 Hwy 4)" })).toBe("Drive-up");
    expect(storageTypeLabel({ ...unit, typeName: "Addington Forks", climate: true })).toBe("Climate-controlled");
    expect(storageTypeLabel({ ...unit, typeName: "Container" })).toBe("Container");
  });
});
