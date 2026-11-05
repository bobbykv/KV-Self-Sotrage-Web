import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const state = vi.hoisted(() => ({ snaps: [] as Array<Record<string, unknown>> }));

vi.hoisted(() => {
  process.env.SITELINK_MODE = "live";
  process.env.SITELINK_CORP_CODE = "CORP";
  process.env.SITELINK_API_USERNAME = "corpuser";
  process.env.SITELINK_API_PASSWORD = "secret-password";
  process.env.SITELINK_API_LICENSE_KEY = "LICENSEKEY99";
  process.env.SITELINK_LOCATION_CODES = "haley:L001,hwy4:L002,stellarton:L003";
  delete process.env.APP_TEST_MODE;
  delete process.env.SITELINK_REFRESH_PAUSED;
});

vi.mock("@/lib/db", () => ({
  db: {
    siteLinkSnapshot: {
      findMany: vi.fn(async () => state.snaps),
      upsert: vi.fn(async () => ({})),
    },
    hold: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/job-lock", () => ({
  withJobLock: async (_name: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(async () => ({
    pollIntervalMinutes: 30,
    allUnitsPollMinutes: 120,
    priceListPollMinutes: 360,
    sitelinkRefreshPaused: true,
  })),
}));

vi.mock("@/lib/sitelink/client", () => ({
  sitelink: {
    availableUnits: vi.fn(async (loc: string) => {
      calls.push(`available:start:${loc}`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      calls.push(`available:end:${loc}`);
      return { units: [], lastTimePolled: "1" };
    }),
    priceList: vi.fn(async (loc: string) => {
      calls.push(`price:start:${loc}`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      calls.push(`price:end:${loc}`);
      return [];
    }),
    allUnits: vi.fn(async () => []),
    discountPlans: vi.fn(async () => ({ plans: [], source: "sitelink", error: null, winterPlanId: null })),
    dailyReports: vi.fn(async (loc: string) => {
      calls.push(`report:${loc}`);
      return {};
    }),
  },
}));

import { getInventory, PAGE_VIEWS_START_SITELINK_REFRESH, refreshInventory, refreshReports } from "@/lib/inventory";

describe("SiteLink refresh scheduling", () => {
  beforeEach(() => {
    calls.length = 0;
    state.snaps = [];
    delete process.env.SITELINK_REFRESH_PAUSED;
  });

  it("does not start a refresh from a page read, even when the snapshot is stale", async () => {
    expect(PAGE_VIEWS_START_SITELINK_REFRESH).toBe(false);
    const src = readFileSync(new URL("../src/lib/inventory.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bafter\s*\(/);
    expect(src).not.toMatch(/void\s+refreshInventory/);
    state.snaps = [
      {
        id: "haley:available",
        locationKey: "haley",
        kind: "available",
        data: [
          {
            locationKey: "haley",
            unitId: 5,
            rented: false,
            rentable: true,
            excludedFromWebsite: false,
            waitingListReserved: false,
            rate: 10,
          },
        ],
        refreshedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        lastError: null,
      },
    ];
    const rows = await getInventory();
    expect(rows.find((row) => row.location === "haley")?.units.map((unit) => unit.unitId)).toEqual([5]);
    expect(calls).toEqual([]);
  });

  it("skips every location while automatic refresh is paused", async () => {
    process.env.SITELINK_REFRESH_PAUSED = "1";
    const results = await refreshInventory({ force: true });
    expect(results?.every((row) => row.paused && row.skipped)).toBe(true);
    expect(calls).toEqual([]);
    const reports = await refreshReports();
    expect(reports?.every((row) => row.paused)).toBe(true);
    expect(calls).toEqual([]);
  });

  it("runs a paused probe for one location only", async () => {
    process.env.SITELINK_REFRESH_PAUSED = "1";
    const results = await refreshInventory({ probe: true, force: true, full: true, locations: ["stellarton"], kinds: ["available"] });
    expect(results?.map((row) => ({ location: row.location, kind: row.kind, ok: row.ok }))).toEqual([{ location: "stellarton", kind: "available", ok: true }]);
    expect(calls).toEqual(["available:start:stellarton", "available:end:stellarton"]);
    calls.length = 0;
    await expect(refreshInventory({ probe: true, locations: ["haley", "hwy4"], kinds: ["available"] })).rejects.toThrow(/exactly one location/);
    expect(calls).toEqual([]);
  });

  it("walks locations and methods one at a time when refresh is allowed", async () => {
    process.env.SITELINK_REFRESH_PAUSED = "0";
    await refreshInventory({ force: true, kinds: ["available", "pricelist"] });
    expect(calls).toEqual([
      "available:start:haley",
      "available:end:haley",
      "price:start:haley",
      "price:end:haley",
      "available:start:hwy4",
      "available:end:hwy4",
      "price:start:hwy4",
      "price:end:hwy4",
      "available:start:stellarton",
      "available:end:stellarton",
      "price:start:stellarton",
      "price:end:stellarton",
    ]);
  });
});
