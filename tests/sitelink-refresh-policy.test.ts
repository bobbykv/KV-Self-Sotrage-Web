import { describe, expect, it } from "vitest";
import { forEachSequential, isAutomaticRefreshPaused, normalizeRefreshLocations, parseProbeRequest } from "@/lib/sitelink/refresh-policy";

describe("automatic refresh pause", () => {
  const live = { live: true as const };

  it("stays paused in live mode until someone explicitly allows it", () => {
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: true }, { ...live, envFlag: undefined })).toBe(true);
    expect(isAutomaticRefreshPaused({}, { ...live, envFlag: undefined })).toBe(true);
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: false }, { ...live, envFlag: undefined })).toBe(false);
  });

  it("lets the env flag override the checkbox", () => {
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: false }, { ...live, envFlag: "1" })).toBe(true);
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: false }, { ...live, envFlag: "paused" })).toBe(true);
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: true }, { ...live, envFlag: "0" })).toBe(false);
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: true }, { ...live, envFlag: "false" })).toBe(false);
  });

  it("does not pause mock or test mode, which never calls SiteLink", () => {
    expect(isAutomaticRefreshPaused({ sitelinkRefreshPaused: true }, { live: false, envFlag: "1" })).toBe(false);
  });
});

describe("one location at a time", () => {
  it("keeps requested order and drops duplicates", () => {
    expect(normalizeRefreshLocations(undefined)).toEqual(["haley", "hwy4", "stellarton"]);
    expect(normalizeRefreshLocations(["stellarton", "haley", "stellarton"])).toEqual(["stellarton", "haley"]);
  });

  it("does not start the next item until the previous one finishes", async () => {
    const events: string[] = [];
    await forEachSequential(["haley", "hwy4", "stellarton"], async (loc) => {
      events.push(`start:${loc}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push(`end:${loc}`);
    });
    expect(events).toEqual([
      "start:haley",
      "end:haley",
      "start:hwy4",
      "end:hwy4",
      "start:stellarton",
      "end:stellarton",
    ]);
  });
});

describe("probe request", () => {
  it("defaults to one availability call and rejects a missing location", () => {
    expect(parseProbeRequest(new URLSearchParams("location=hwy4"))).toEqual({ ok: true, location: "hwy4", kind: "available" });
    expect(parseProbeRequest(new URLSearchParams("location=haley&kind=pricelist"))).toEqual({ ok: true, location: "haley", kind: "pricelist" });
    expect(parseProbeRequest(new URLSearchParams("kind=available")).ok).toBe(false);
    expect(parseProbeRequest(new URLSearchParams("location=hwy4&kind=available,pricelist")).ok).toBe(false);
  });
});
