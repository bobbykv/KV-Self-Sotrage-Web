import { describe, expect, it } from "vitest";
import { halifaxDate, moveInWindow, parseMoveInDate } from "@/lib/move-in-date";

describe("Halifax move-in calendar dates", () => {
  it("accepts today after UTC midnight while Halifax is still on the previous day", () => {
    const now = new Date("2026-11-06T01:00:00Z");
    expect(halifaxDate(now)).toBe("2026-11-05");
    expect(parseMoveInDate("2026-11-05", 30, now)?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(moveInWindow(30, now)).toEqual({ min: "2026-11-05", max: "2026-12-05" });
    expect(parseMoveInDate("2026-12-05", 30, now)).not.toBeNull();
    expect(parseMoveInDate("2026-12-06", 30, now)).toBeNull();
    expect(parseMoveInDate("2026-11-04", 30, now)).toBeNull();
  });
  it("counts calendar days across daylight saving changes", () => {
    const now = new Date("2026-10-15T15:00:00Z");
    expect(moveInWindow(30, now)).toEqual({ min: "2026-10-15", max: "2026-11-14" });
    expect(parseMoveInDate("2026-11-14", 30, now)).not.toBeNull();
  });
  it("rejects impossible dates and timestamps", () => {
    const now = new Date("2026-02-01T12:00:00Z");
    expect(parseMoveInDate("2026-02-30", 30, now)).toBeNull();
    expect(parseMoveInDate("2026-02-03T00:00:00Z", 30, now)).toBeNull();
  });
});
