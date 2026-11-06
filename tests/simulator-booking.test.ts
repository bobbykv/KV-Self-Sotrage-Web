import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ payload: null as unknown, holds: [] as Record<string, unknown>[], snapshots: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { appTestMode: true, sitelinkMode: "mock", HST_RATE: 0.14 }, cookieNames: { hold: "hold" }, assertSiteLinkConfig: () => {} }));
vi.mock("@/lib/db", () => ({ db: {
  siteLinkSnapshot: { findMany: state.snapshots },
  hold: {
    findMany: async () => state.holds,
    create: async ({ data }: { data: Record<string, unknown> }) => { const h = { ...data, status: "active" }; state.holds.push(h); return h; },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const h = state.holds.find((h) => h.id === where.id)!; Object.assign(h, data); return h;
    },
  },
} }));
vi.mock("@/lib/sitelink/mock-store", () => ({
  loadMockPayload: async () => structuredClone(state.payload),
  saveMockPayload: async (payload: unknown) => { state.payload = structuredClone(payload); },
}));
vi.mock("@/lib/sitelink/budget", () => ({ recordCall: async () => {} }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ maintenanceMode: false, holdMinutes: 20 }) }));
vi.mock("@/lib/discount-visibility", () => ({ getDiscountToggles: async () => ({}) }));

import { getInventory } from "@/lib/inventory";
import { createHold } from "@/lib/holds";
import { sitelink } from "@/lib/sitelink/client";
import { initMockState, resetMockMemory } from "@/lib/sitelink/mock";

describe("simulator listings and checkout use the same persisted inventory", () => {
  beforeEach(() => {
    state.payload = initMockState();
    state.holds = [];
    resetMockMemory();
    state.snapshots.mockReset().mockResolvedValue([{ id: "hwy4:available", data: [{ unitId: 65016 }], refreshedAt: new Date() }]);
  });

  it("does not read live snapshot IDs or prices in test mode", async () => {
    const inventory = await getInventory();
    expect(state.snapshots).not.toHaveBeenCalled();
    expect(inventory.every((row) => row.availability === "demo")).toBe(true);
    for (const row of inventory) {
      expect(row.units.length).toBeGreaterThan(0);
      for (const unit of row.units) expect(await sitelink.unitById(row.location, unit.unitId)).toMatchObject({ unitId: unit.unitId });
    }
    expect(inventory.find((r) => r.location === "haley")?.units.some((u) => u.climate)).toBe(true);
    expect(inventory.find((r) => r.location === "hwy4")?.units.some((u) => u.vehicle)).toBe(true);
  });

  it.each(["hwy4", "stellarton"] as const)("creates a priced hold and reservation for a listed %s unit", async (locationKey) => {
    const rows = await getInventory();
    const unit = rows.find((r) => r.location === locationKey)!.units[0];
    const hold = await createHold({ locationKey, unitId: unit.unitId, firstName: "AUDIT TEST", lastName: "Booking", email: "audit@example.com", phone: "9025550100", moveInDate: new Date() });
    expect(hold).toMatchObject({ unitId: unit.unitId, status: "active", quotedRate: unit.standardRate, waitingId: expect.any(Number), tenantId: expect.any(Number) });
    expect(hold.costBreakdown).toMatchObject({ total: expect.any(Number), tax: expect.any(Number) });
    expect((await getInventory()).find((r) => r.location === locationKey)?.units.some((u) => u.unitId === unit.unitId)).toBe(false);
    // Removing the website hold still leaves the persisted simulator reservation.
    state.holds = [];
    resetMockMemory();
    expect((await getInventory()).find((r) => r.location === locationKey)?.units.some((u) => u.unitId === unit.unitId)).toBe(false);
  });
});
