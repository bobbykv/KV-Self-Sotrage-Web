import { describe, expect, it } from "vitest";
import { groupUnits } from "@/lib/catalog";
import { recommendStorage, recommendedSizeHref } from "@/lib/size-finder";
import { catalogueFaq } from "@/lib/catalog-faq";
import { mockUnitsFor } from "@/lib/sitelink/mock";
import type { FaqCategory } from "@/lib/faq";

const base = { ...mockUnitsFor("hwy4")[0], rented: false, rentable: true, vehicle: false, standardRate: 98, rate: 98 };
const groups = groupUnits([
  { ...base, unitId: 42, widthFt: 5, lengthFt: 10 },
  { ...base, unitId: 43, widthFt: 10, lengthFt: 15 },
  { ...base, unitId: 44, widthFt: 10, lengthFt: 10, locationKey: "haley", climate: true },
]);

describe("catalogue-backed size guidance", () => {
  it("recommends the existing 5x10 rather than inventing a 5x5", () => {
    const result = recommendStorage({ what: "boxes", location: "hwy4" }, groups);
    expect(result.closest).toBe(false);
    expect(result.groups.map((g) => [g.widthFt, g.lengthFt])).toEqual([[5, 10]]);
  });
  it("links directly to the closest available size when the requested range is full", () => {
    const answer = { what: "home4", location: "hwy4" } as const;
    expect(recommendStorage(answer, groups)).toMatchObject({ closest: true, groups: [expect.objectContaining({ bestUnitId: 43 })] });
    expect(recommendedSizeHref(answer, groups)).toBe("/units/hwy4/43");
  });
  it("keeps climate/location filters and offers contact instead of an empty result", () => {
    expect(recommendStorage({ what: "apt1", sensitive: true, location: "hwy4" }, groups).groups.map((g) => g.locationKey)).toEqual(["haley"]);
    expect(recommendStorage({ what: "boxes", location: "stellarton" }, groups).groups).toEqual([]);
    expect(recommendedSizeHref({ what: "boxes", location: "stellarton" }, groups)).toBe("/contact");
  });
  it("never recommends groups with zero remaining availability", () => {
    expect(recommendStorage({ what: "boxes" }, groups.map((g) => ({ ...g, available: 0 }))).groups).toEqual([]);
  });
  it("includes the owner-confirmed promotion and insurance answer alongside existing FAQ copy", () => {
    const result = catalogueFaq([{ name: "General", entries: [] }], groups)[0].entries;
    expect(result.find((e) => e.id === "current-promotion")?.answer).toContain("30% off rent for their first 3 months");
    expect(result.find((e) => e.id === "tenant-insurance")?.answer).toContain("does not supply insurance");
  });
  it("replaces static FAQ sizes with current links while preserving other copy", () => {
    const categories: FaqCategory[] = [{ name: "Choosing", entries: [
      { id: "size", category: "Choosing", question: "What size do I need?", answer: "Try 5 × 5 or 10 × 30." },
      { id: "climate", category: "Choosing", question: "Where can I get climate-controlled storage?", answer: "Keep climate copy unchanged." },
      { id: "vehicle", category: "Choosing", question: "Do you have vehicle parking?", answer: "Keep vehicle copy unchanged." },
      { id: "rates", category: "Choosing", question: "What are the Exit 31 unit sizes and starting rates?", answer: "Static rates." },
    ] }];
    const result = catalogueFaq(categories, groups)[0].entries;
    expect(result[0].answer).not.toMatch(/5 × 5|10 × 30/);
    expect(result[0].answer).toContain("/units/hwy4/42");
    expect(result[1]).toEqual(categories[0].entries[1]);
    expect(result[2]).toEqual(categories[0].entries[2]);
    expect(result[3].answer).toContain("$98.00/month");
    expect(categories[0].entries[0].answer).toBe("Try 5 × 5 or 10 × 30.");
  });
});
