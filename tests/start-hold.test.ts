import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ create: vi.fn(), limit: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/holds", () => ({ createHold: mock.create, HOLD_COOKIE: "hold", HoldError: class extends Error {} }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: async () => "audit", rateLimit: mock.limit }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mock.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { startHold } from "@/app/(site)/units/[location]/[unitId]/actions";

function form(date: string) {
  const f = new FormData();
  Object.entries({ location: "hwy4", unitId: "65016", firstName: "AUDIT TEST", lastName: "Booking", email: "audit-test@example.com", phone: "9025550100", moveInDate: date }).forEach(([k, v]) => f.set(k, v));
  return f;
}

describe("public hold date validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T01:00:00Z"));
    vi.clearAllMocks();
    mock.limit.mockResolvedValue(true);
    mock.create.mockResolvedValue({ id: "audit-hold" });
  });
  afterEach(() => vi.useRealTimers());
  it("creates a hold for today in Halifax and redirects to checkout", async () => {
    await expect(startHold({}, form("2026-11-05"))).rejects.toThrow("redirect:/checkout/audit-hold");
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ moveInDate: new Date("2026-11-05T12:00:00Z") }));
    expect(mock.cookie).toHaveBeenCalled();
  });
  it("rejects an invalid date before consuming the hold rate limit", async () => {
    expect(await startHold({}, form("2026-11-04"))).toEqual({ error: expect.stringContaining("next 30 days") });
    expect(mock.limit).not.toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
  });
});
