import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ payload: null as unknown, holds: [] as Record<string, unknown>[], snapshots: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { appTestMode: true, sitelinkMode: "live", PAYMENT_MODE: "passthrough", HST_RATE: 0.14 }, cookieNames: { hold: "hold" }, assertSiteLinkConfig: () => {} }));
vi.mock("@/lib/db", () => ({ db: {
  siteLinkSnapshot: { findMany: state.snapshots },
  paymentReceipt: { create: vi.fn().mockResolvedValue({}) },
  hold: {
    findUnique: async ({ where }: { where: { id: string } }) => state.holds.find((h) => h.id === where.id) ?? null,
    findMany: async () => state.holds,
    create: async ({ data }: { data: Record<string, unknown> }) => { const h = { idPhotoUploaded: false, licenseNumber: null, licenseRegion: null, failureCount: 0, ...data, status: "active" }; state.holds.push(h); return h; },
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
vi.mock("@/lib/leads", () => ({ captureLead: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ maintenanceMode: false, holdMinutes: 20 }) }));
vi.mock("@/lib/discount-visibility", () => ({ getDiscountToggles: async () => ({}) }));

import { getInventory } from "@/lib/inventory";
import { createHold, payPassthrough, syncTenantVerification } from "@/lib/holds";
import { sitelink } from "@/lib/sitelink/client";
import { staffMoveIn } from "@/lib/staff-office";
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

  it("saves a manual address without sending an ID photo or clearing an existing licence", async () => {
    const unit = (await getInventory()).find((r) => r.location === "hwy4")!.units[0];
    const hold = await createHold({ locationKey: "hwy4", unitId: unit.unitId, firstName: "AUDIT TEST", lastName: "Manual", email: "manual@example.com", phone: "9025550100", moveInDate: new Date() });
    await sitelink.updateTenantForLease("hwy4", hold.tenantId!, { firstName: hold.firstName, lastName: hold.lastName, email: hold.email, phone: hold.phone, addr1: "Old address", city: "Antigonish", region: "NS", postalCode: "B2G 1A1", license: "OLD12345", licRegion: "NS" });
    const upload = vi.spyOn(sitelink, "uploadTenantImage");
    await syncTenantVerification(hold, { addr1: "12 Main Street", city: "Antigonish", region: "NS", postalCode: "B2G 1A1" });
    const info = await sitelink.tenantInfo("hwy4", hold.tenantId!);
    expect(info?.raw).toMatchObject({ sAddr1: "12 Main Street", sLicense: "OLD12345", sLicRegion: "NS" });
    expect(upload).not.toHaveBeenCalled();
    upload.mockRestore();
  });

  it("completes a simulated rental with a manual address and no licence or ID photo", async () => {
    const unit = (await getInventory()).find((r) => r.location === "hwy4")!.units[0];
    const hold = await createHold({ locationKey: "hwy4", unitId: unit.unitId, firstName: "AUDIT TEST", lastName: "Manual checkout", email: "manual-checkout@example.com", phone: "9025550100", moveInDate: new Date() });
    const upload = vi.spyOn(sitelink, "uploadTenantImage");
    const completed = await payPassthrough(hold.id, { number: "4242424242424242", cvv: "123", expiry: "12/30", name: "Audit Test", street: "12 Main Street", postal: "B2G 1A1" }, { addr1: "12 Main Street", city: "Antigonish", region: "NS", postalCode: "B2G 1A1" });
    expect(completed.status).toBe("moved_in");
    expect(upload).not.toHaveBeenCalled();
    expect((await sitelink.unitById("hwy4", unit.unitId))?.rented).toBe(true);
    upload.mockRestore();
  });

  it("completes a simulated staff move-in without a licence", async () => {
    const unit = (await getInventory()).find((r) => r.location === "stellarton")!.units[0];
    const result = await staffMoveIn({ mode: "movein", locationKey: "stellarton", unitId: unit.unitId, firstName: "AUDIT TEST", lastName: "Office", email: "office@example.com", phone: "9025550100", moveInDate: new Date(), concessionId: null, addr1: "12 Main Street", city: "Stellarton", region: "NS", postalCode: "B0K 1S0", payMethod: "cash" });
    expect(result.ledgerId).toBeGreaterThan(0);
    expect((await sitelink.unitById("stellarton", unit.unitId))?.rented).toBe(true);
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
