import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatHours } from "@/config/locations";
import { CostBreakdown } from "@/components/CostBreakdown";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { allowSearchIndexing, showDraftNotices, siteEnv } from "@/lib/site-env";
import { stockPhotoForUnit } from "@/lib/photos";

describe("publicUrl / lease never localhost", () => {
  it("rewrites localhost absolute paths against a public origin", async () => {
    vi.resetModules();
    process.env.APP_URL = "https://kvselfstorage.ca";
    const { publicUrl, publicSiteOrigin } = await import("@/lib/site-url");
    const origin = await publicSiteOrigin();
    expect(origin).not.toMatch(/localhost|127\.0\.0\.1/);
    const url = await publicUrl("http://localhost:3000/portal");
    expect(url).toBe("https://kvselfstorage.ca/portal");
    expect(url).not.toMatch(/localhost/);
  });
});

describe("chat size question routes to units", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rulesChat routes Haley size questions to unit listings", async () => {
    vi.doMock("@/lib/chat/tools", () => ({
      searchUnits: vi.fn(async () => ({
        as_of: null,
        available: [
          {
            location: "haley",
            location_name: "Haley Road",
            size: "10x10",
            size_label: "10 × 10",
            type: "Standard",
            monthly_price: 120,
            available_count: 2,
            hold_url: "/units/haley/1",
          },
        ],
        full: [],
      })),
      getFaqAnswer: vi.fn(async () => ({ results: [] })),
      captureLeadTool: vi.fn(),
      handoffToHuman: vi.fn(),
    }));
    // engine imports tools by name — patch getFaq via faq module used inside engine
    vi.doMock("@/lib/faq", () => ({
      getFaq: vi.fn(async () => []),
      searchFaq: vi.fn(() => []),
      parseFaq: vi.fn(),
    }));
    const { rulesChat } = await import("@/lib/chat/engine");
    // Also need to mock inventory path through tools - engine imports searchUnits from tools
    const reply = await rulesChat("What sizes do you have at Haley Rd?");
    expect(reply.reply.toLowerCase()).toMatch(/haley|space|compare|unit/);
    expect(reply.actions?.some((a) => a.type === "link" && "href" in a && String(a.href).includes("/units"))).toBe(true);
  });
});

describe("photo stock / fallbacks", () => {
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
    const { unitTypePhotoUrl, stockPhotoForUnit: stock } = await import("@/lib/photos");
    const url = await unitTypePhotoUrl({
      locationKey: "haley",
      typeName: "Standard",
      widthFt: 10,
      lengthFt: 10,
      inside: false,
      vehicle: false,
    });
    expect(url).toBe(stock({}));
  });
});

describe("CostBreakdown estimated label", () => {
  it("renders totalLabel text", () => {
    const cost = {
      lines: [{ label: "Rent", amount: 100, kind: "rent" as const }],
      preTax: 100,
      tax: 14,
      taxLabel: "HST",
      taxSource: "computed" as const,
      total: 114,
    };
    const html = renderToStaticMarkup(
      createElement(CostBreakdown, { cost, hstRate: 0.14, totalLabel: "Estimated move-in total" }),
    );
    expect(html).toContain("Estimated move-in total");
  });
});

describe("allowSearchIndexing / robots when not production", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("disallows indexing outside production", () => {
    process.env.NEXT_PUBLIC_SITE_ENV = "staging";
    delete process.env.APP_TEST_MODE;
    expect(siteEnv()).toBe("staging");
    expect(allowSearchIndexing()).toBe(false);
    expect(showDraftNotices()).toBe(true);
  });

  it("allows indexing in production", () => {
    process.env.NEXT_PUBLIC_SITE_ENV = "production";
    delete process.env.APP_TEST_MODE;
    expect(allowSearchIndexing()).toBe(true);
    expect(showDraftNotices()).toBe(false);
  });
});

describe("formatHours a.m./p.m.", () => {
  it("uses a.m./p.m. without trailing period on the range", () => {
    const s = formatHours({ open: "08:30", close: "16:30" });
    expect(s).toBe("8:30 a.m. to 4:30 p.m.");
    expect(s.endsWith(".")).toBe(false);
  });
});
