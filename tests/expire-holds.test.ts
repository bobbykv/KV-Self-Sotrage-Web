import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ holds: [] as Array<Record<string, unknown>> }));

vi.mock("@/lib/db", () => ({
  db: {
    hold: {
      findMany: vi.fn(async (args) => {
        if (!args.select || "licenseNumber" in args.select) throw new Error("Hold.licenseNumber does not exist");
        return state.holds;
      }),
      update: vi.fn(async (args) => {
        if (!args.select || "licenseNumber" in args.select) throw new Error("Hold.licenseNumber does not exist");
        return { id: args.where.id };
      }),
    },
  },
}));
vi.mock("@/lib/sitelink/client", () => ({ sitelink: { updateReservation: vi.fn() }, SiteLinkError: class extends Error {} }));
vi.mock("@/lib/sitelink/enums", () => ({ RESERVATION_STATUS_CANCELLED: null, RESERVATION_CANCEL_TYPE: null }));

import { db } from "@/lib/db";
import { expireHolds } from "@/lib/holds";

describe("hold expiry before the tenant-verification migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.holds = [];
  });

  it("returns zero when no holds have lapsed", async () => {
    expect(await expireHolds()).toBe(0);
    expect(db.hold.update).not.toHaveBeenCalled();
  });

  it("expires lapsed holds without reading verification columns in either query", async () => {
    state.holds = [{ id: "expired-hold", waitingId: null, tenantId: null }];
    expect(await expireHolds()).toBe(1);
    expect(db.hold.update).toHaveBeenCalledWith({
      where: { id: "expired-hold" },
      data: { status: "expired" },
      select: { id: true },
    });
  });
});
