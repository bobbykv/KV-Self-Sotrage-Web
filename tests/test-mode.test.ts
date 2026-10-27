import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAppTestMode } from "@/lib/test-mode";
import { invokeLive, retCode } from "@/lib/sitelink/soap";
import {
  SIM_CARD_APPROVE,
  SIM_CARD_DECLINE,
  SIM_CARD_TIMEOUT,
  initMockState,
  invokeMock,
  resetMockMemory,
} from "@/lib/sitelink/mock";
import { mapUnit } from "@/lib/sitelink/mappers";

vi.mock("@/lib/sitelink/mock-store", () => {
  let payload: unknown = null;
  return {
    loadMockPayload: async () => payload,
    saveMockPayload: async (next: unknown) => {
      payload = structuredClone(next);
    },
    __resetStore: () => {
      payload = null;
    },
  };
});

const store = await import("@/lib/sitelink/mock-store");

describe("APP_TEST_MODE helpers", () => {
  afterEach(() => {
    delete process.env.APP_TEST_MODE;
  });

  it("detects APP_TEST_MODE=1", () => {
    process.env.APP_TEST_MODE = "1";
    expect(isAppTestMode()).toBe(true);
    process.env.APP_TEST_MODE = "0";
    expect(isAppTestMode()).toBe(false);
  });

  it("blocks live SOAP fetch before network I/O", async () => {
    process.env.APP_TEST_MODE = "1";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope"));
    await expect(
      invokeLive(
        {
          callCenterEndpoint: "https://example.test/CallCenterWs.asmx",
          reportingEndpoint: "https://example.test/ReportingWs.asmx",
          corpCode: "X",
          username: "u",
          password: "p",
          timeoutMs: 1000,
        },
        "SiteInformation",
        "LOC",
        {},
      ),
    ).rejects.toThrow(/blocked in APP_TEST_MODE/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("fallback inventory", () => {
  it("matches verified Exit 31 rates and the Haley and Stellarton mix", () => {
    const st = initMockState();
    const open = (loc: "haley" | "hwy4" | "stellarton") => st.units[loc].map((u) => mapUnit(loc, u)).filter((u) => !u.rented);
    const hwy = open("hwy4");
    const sized = (w: number, l: number) => hwy.filter((u) => u.widthFt === w && u.lengthFt === l);
    expect(sized(5, 10)).toHaveLength(4);
    expect(sized(10, 10)).toHaveLength(9);
    expect(sized(10, 15)).toHaveLength(4);
    expect(new Set(sized(5, 10).map((u) => u.rate))).toEqual(new Set([98]));
    expect(new Set(sized(10, 10).map((u) => u.rate))).toEqual(new Set([140]));
    expect(new Set(sized(10, 15).map((u) => u.rate))).toEqual(new Set([177]));
    const winter = hwy.filter((u) => /winter storage/i.test(u.typeName));
    expect(winter.length).toBeGreaterThan(0);
    expect(winter.every((u) => u.vehicle && !u.inside && u.rate === 399 && /\$399 winter outdoor storage package/i.test(u.description))).toBe(true);

    const haley = st.units.haley.map((u) => mapUnit("haley", u));
    expect(haley.some((u) => u.climate)).toBe(true);
    expect(haley.some((u) => u.vehicle)).toBe(false);

    const stel = st.units.stellarton.map((u) => mapUnit("stellarton", u));
    expect(stel.some((u) => u.vehicle || /winter|\$399/i.test(u.description))).toBe(false);
    expect(stel.every((u) => /nokē smart entry/i.test(u.description))).toBe(true);
    const stelSizes = stel.map((u) => `${u.widthFt}x${u.lengthFt}`);
    expect(new Set(stelSizes)).toEqual(new Set(["5x10", "10x10", "10x15", "10x20"]));
  });
});

describe("persistent mock payments and portal seed", () => {
  beforeEach(() => {
    resetMockMemory();
    (store as { __resetStore?: () => void }).__resetStore?.();
  });

  it("seeds the demo portal tenant with overdue Haley and autopay Stellarton ledgers", async () => {
    const login = await invokeMock("TenantLogin", "haley", { sTenantLogin: "demo@kvselfstorage.ca", sTenantPassword: "demo1234" });
    expect(retCode(login)).toBe(501);
    const ledgers = await invokeMock("LedgersByTenantID_v3", "haley", { sTenantID: "501" });
    expect(ledgers.Table?.[0]).toMatchObject({ sUnitName: expect.any(String) });
    expect(Number(ledgers.Table?.[0].dcPastDue)).toBeGreaterThan(0);

    const stel = await invokeMock("TenantLogin", "stellarton", { sTenantLogin: "demo@kvselfstorage.ca", sTenantPassword: "demo1234" });
    expect(retCode(stel)).toBe(701);
    const billing = await invokeMock("TenantBillingInfoByTenantID_v3", "stellarton", { iTenantID: 701 });
    expect(billing.Table?.[0].iAutoBillType).toBe("1");
  });

  it("approves, declines and times out simulated cards; rejects repeat move-in", async () => {
    resetMockMemory();
    (store as { __resetStore?: () => void }).__resetStore?.();
    // Ensure a vacant unit + tenant + reservation
    const units = await invokeMock("UnitsInformationAvailableUnitsOnly_v2", "hwy4", { lngLastTimePolled: "0" });
    const unitId = units.Table?.[0].UnitID;
    expect(unitId).toBeTruthy();

    const tenant = await invokeMock("TenantNewDetailed_v3", "hwy4", {
      sFName: "Fake",
      sLName: "Customer",
      sEmail: "fake.customer@example.test",
      sPhone: "9025550199",
      sWebPassword: "",
    });
    const tenantId = retCode(tenant);
    const res = await invokeMock("ReservationNewWithSource_v5", "hwy4", {
      sTenantID: String(tenantId),
      sUnitID: String(unitId),
      dExpires: new Date(Date.now() + 20 * 60_000).toISOString(),
      dNeeded: new Date().toISOString(),
      dcQuotedRate: 90,
      QTRentalTypeID: 2,
      iSource: 5,
      sSource: "Website",
    });
    const waitingId = String(retCode(res));

    await expect(
      invokeMock("MoveInWithDiscount_v7", "hwy4", {
        TenantID: tenantId,
        UnitID: unitId,
        WaitingID: waitingId,
        sCreditCardNumber: SIM_CARD_TIMEOUT,
      }),
    ).rejects.toThrow(/timeout/i);

    const declined = await invokeMock("MoveInWithDiscount_v7", "hwy4", {
      TenantID: tenantId,
      UnitID: unitId,
      WaitingID: waitingId,
      sCreditCardNumber: SIM_CARD_DECLINE,
    });
    expect(retCode(declined)).toBeLessThan(0);

    const approved = await invokeMock("MoveInWithDiscount_v7", "hwy4", {
      TenantID: tenantId,
      UnitID: unitId,
      WaitingID: waitingId,
      sCreditCardNumber: SIM_CARD_APPROVE,
    });
    expect(retCode(approved)).toBeGreaterThan(0);

    const repeat = await invokeMock("MoveInWithDiscount_v7", "hwy4", {
      TenantID: tenantId,
      UnitID: unitId,
      WaitingID: waitingId,
      sCreditCardNumber: SIM_CARD_APPROVE,
    });
    expect(retCode(repeat)).toBe(-12);
  });

  it("keeps mock state across in-process memory reset when the store has a payload", async () => {
    const created = await invokeMock("TenantNewDetailed_v3", "haley", {
      sFName: "Persist",
      sLName: "Me",
      sEmail: "persist.me@example.test",
      sPhone: "9025550188",
      sWebPassword: "Secret-Pass-99",
    });
    const id = retCode(created);
    resetMockMemory();
    const login = await invokeMock("TenantLogin", "haley", { sTenantLogin: "persist.me@example.test", sTenantPassword: "Secret-Pass-99" });
    expect(retCode(login)).toBe(id);
  });

  it("initMockState includes completedMoves for idempotency tracking", () => {
    expect(initMockState().completedMoves).toEqual([]);
  });

  it("stores license and address on the tenant and the ID filename without image bytes", async () => {
    resetMockMemory();
    (store as { __resetStore?: () => void }).__resetStore?.();
    const created = await invokeMock("TenantNewDetailed_v3", "hwy4", {
      sFName: "Ada",
      sLName: "Holder",
      sEmail: "ada.holder@example.test",
      sPhone: "9025550142",
      sWebPassword: "demo1234",
    });
    const tenantId = retCode(created);
    const payload = "NOTSTORED_IMAGE_BYTES_12345";
    const updated = await invokeMock("TenantUpdate_v3", "hwy4", {
      iTenantID: tenantId,
      sFName: "Ada",
      sLName: "Holder",
      sEmail: "ada.holder@example.test",
      sPhone: "9025550142",
      sAddr1: "12 Main St",
      sCity: "Antigonish",
      sRegion: "NS",
      sPostalCode: "B2G 1A1",
      sCountry: "Canada",
      sCountryCode: "CA",
      sLicense: "NS123456",
      sLicRegion: "NS",
      sGateCode: "4821",
    });
    expect(retCode(updated)).toBeGreaterThan(0);
    const uploaded = await invokeMock("TenantImageUpload", "hwy4", {
      iTenantID: tenantId,
      aryImageBytes: payload,
      sFileName: "drivers-license.jpg",
    });
    expect(retCode(uploaded)).toBeGreaterThan(0);
    expect(JSON.stringify(uploaded)).not.toContain(payload);
    const info = await invokeMock("TenantInfoByTenantID", "hwy4", { iTenantID: tenantId });
    expect(info.Table?.[0]).toMatchObject({
      sAddr1: "12 Main St",
      sCity: "Antigonish",
      sRegion: "NS",
      sPostalCode: "B2G 1A1",
      sLicense: "NS123456",
      sLicRegion: "NS",
      sIDPhotoFileName: "drivers-license.jpg",
    });
    expect(JSON.stringify(info)).not.toContain(payload);
    const login = await invokeMock("TenantLogin", "hwy4", { sTenantLogin: "ada.holder@example.test", sTenantPassword: "demo1234" });
    expect(retCode(login)).toBe(tenantId);
  });
});
