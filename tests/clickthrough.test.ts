import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatHours } from "@/config/locations";
import { allowSearchIndexing, showDraftNotices, siteEnv } from "@/lib/site-env";
import { stockPhotoForUnit } from "@/lib/photos";

describe("publicUrl never returns localhost when a public host is configured", () => {
  it("rewrites localhost URLs to the public origin", async () => {
    vi.resetModules();
    process.env.APP_URL = "https://kvselfstorage.ca";
    const { publicUrl, publicSiteOrigin } = await import("@/lib/site-url");
    const origin = await publicSiteOrigin();
    expect(origin).not.toMatch(/localhost|127\.0\.0\.1/);
    const url = await publicUrl("http://localhost:3000/api/portal/lease");
    expect(url).toContain("/api/portal/lease");
    expect(url).not.toMatch(/localhost|127\.0\.0\.1/);
  });
});

describe("chat size question routes to units", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/inventory", () => ({
      getInventory: vi.fn(async () => [
        {
          location: "haley",
          units: [
            {
              locationKey: "haley",
              unitId: 1,
              unitName: "A1",
              unitTypeId: 1,
              typeName: "Standard",
              widthFt: 10,
              lengthFt: 10,
              areaSqFt: 100,
              floor: null,
              climate: false,
              power: false,
              inside: false,
              alarm: false,
              vehicle: false,
              rate: 120,
              standardRate: 120,
              rented: false,
              rentable: true,
              excludedFromWebsite: false,
              waitingListReserved: false,
              description: "",
            },
          ],
          priceList: [],
          refreshedAt: new Date().toISOString(),
          lastError: null,
        },
      ]),
    }));
    vi.doMock("@/lib/faq", () => ({
      getFaq: vi.fn(async () => []),
      searchFaq: vi.fn(() => []),
      parseFaq: vi.fn(),
    }));
  });

  it('rulesChat("What sizes do you have at Haley Rd?") links to units', async () => {
    const { rulesChat } = await import("@/lib/chat/engine");
    const reply = await rulesChat("What sizes do you have at Haley Rd?");
    expect(reply.reply.toLowerCase()).toMatch(/haley|space|compare|10/);
    expect(reply.actions.some((a) => a.type === "link" && "href" in a && String((a as { href: string }).href).includes("/units"))).toBe(true);
  });
});

describe("photo stockPhotoForUnit / unitTypePhotoUrl fallback", () => {
  it("stockPhotoForUnit picks facility for inside/vehicle", () => {
    expect(stockPhotoForUnit({ inside: true })).toBe("/photos/facility-2.jpg");
    expect(stockPhotoForUnit({ vehicle: true })).toBe("/photos/facility-2.jpg");
    expect(stockPhotoForUnit({})).toBe("/photos/hero.jpg");
  });

  it("unitTypePhotoUrl falls back to stock when gallery is empty", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      db: {
        galleryPhoto: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        },
      },
    }));
    const photos = await import("@/lib/photos");
    const url = await photos.unitTypePhotoUrl({
      locationKey: "haley",
      typeName: "Standard",
      widthFt: 10,
      lengthFt: 10,
      inside: false,
      vehicle: false,
    });
    expect(url).toBe(photos.stockPhotoForUnit({}));
  });
});

describe("CostBreakdown estimated label via totalLabel", () => {
  it("wires Estimated move-in total through totalLabel", () => {
    const breakdown = readFileSync("src/components/CostBreakdown.tsx", "utf8");
    const checkout = readFileSync("src/app/(site)/checkout/[holdId]/page.tsx", "utf8");
    expect(breakdown).toContain("totalLabel");
    expect(checkout).toContain('totalLabel={env.PAYMENT_MODE === "passthrough" ? "Total due today" : "Estimated move-in total"}');
  });
});

describe("allowSearchIndexing / robots when not production", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_ENV;
  const prevTest = process.env.APP_TEST_MODE;

  afterEach(() => {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_ENV;
    else process.env.NEXT_PUBLIC_SITE_ENV = prevSite;
    if (prevTest === undefined) delete process.env.APP_TEST_MODE;
    else process.env.APP_TEST_MODE = prevTest;
  });

  it("disallows indexing outside production", () => {
    process.env.NEXT_PUBLIC_SITE_ENV = "staging";
    delete process.env.APP_TEST_MODE;
    expect(siteEnv()).toBe("staging");
    expect(allowSearchIndexing()).toBe(false);
    expect(showDraftNotices()).toBe(true);
  });

  it("allows indexing only in production", () => {
    process.env.NEXT_PUBLIC_SITE_ENV = "production";
    delete process.env.APP_TEST_MODE;
    expect(allowSearchIndexing()).toBe(true);
    expect(showDraftNotices()).toBe(false);
  });
});

describe("formatHours", () => {
  it("uses a.m./p.m. and does not end with a period", () => {
    const s = formatHours({ open: "08:30", close: "16:30" });
    expect(s).toBe("8:30 a.m. to 4:30 p.m.");
    expect(s.endsWith("p.m.")).toBe(true);
    expect(s.endsWith("..")).toBe(false);
  });
});
