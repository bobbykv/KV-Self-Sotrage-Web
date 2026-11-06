import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("real CRM leads with rental testing retained", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("APP_TEST_MODE", "1");
    vi.stubEnv("GHL_LIVE_LEADS_IN_TEST_MODE", "");
    vi.stubEnv("GHL_API_KEY", "example-test-token");
    vi.stubEnv("GHL_LOCATION_ID", "example-location");
    vi.stubEnv("RETELL_API_KEY", "example-retell-key");
    vi.stubEnv("NOTIFY_WEBHOOK_URL", "https://example.test/notify");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("keeps CRM delivery disabled by default in rental test mode", async () => {
    const { env } = await import("@/lib/env");
    expect(env.GHL_API_KEY).toBeUndefined();
    expect(env.GHL_LOCATION_ID).toBeUndefined();
    expect(env.RETELL_API_KEY).toBeUndefined();
  });
  it("enables only CRM leads and webhook verification with the explicit override", async () => {
    vi.stubEnv("GHL_LIVE_LEADS_IN_TEST_MODE", "1");
    const { env } = await import("@/lib/env");
    expect(env.GHL_API_KEY).toBe("example-test-token");
    expect(env.GHL_LOCATION_ID).toBe("example-location");
    expect(env.RETELL_API_KEY).toBe("example-retell-key");
    expect(env.appTestMode).toBe(true);
    expect(env.sitelinkMode).toBe("mock");
    expect(env.sitelinkLocationCodes).toEqual({});
    expect(env.PAYMENT_MODE).toBe("passthrough");
    expect(env.NOTIFY_WEBHOOK_URL).toBeUndefined();
    expect(env.PAY_ONLINE_URL).toBeUndefined();
  });
});
