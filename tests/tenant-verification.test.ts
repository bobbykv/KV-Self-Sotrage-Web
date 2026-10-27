import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOVE_IN_STEPS } from "@/lib/move-in-steps";
import { ID_PHOTO_MAX_BYTES, parseTenantVerification } from "@/lib/tenant-verification";

function photo(bytes: number, kind: "jpeg" | "png" = "jpeg") {
  const buf = Buffer.alloc(bytes);
  if (kind === "jpeg") {
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
  } else {
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  const mime = kind === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const valid = {
  licenseNumber: "NS123456",
  licenseRegion: "NS",
  addr1: "12 Main St",
  city: "Antigonish",
  region: "NS",
  postalCode: "B2G 1A1",
  idPhoto: photo(128),
};

describe("tenant verification", () => {
  it("accepts a Nova Scotia license, address, and JPEG", () => {
    const parsed = parseTenantVerification(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      licenseNumber: "NS123456",
      licenseRegion: "NS",
      addr1: "12 Main St",
      city: "Antigonish",
      region: "NS",
      postalCode: "B2G 1A1",
      fileName: "drivers-license.jpg",
      mime: "image/jpeg",
    });
    expect(parsed.value.imageBase64.length).toBeGreaterThan(10);
  });

  it("defaults a blank issuing region and mailing region to NS", () => {
    const parsed = parseTenantVerification({ ...valid, licenseRegion: "", region: "" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.licenseRegion).toBe("NS");
    expect(parsed.value.region).toBe("NS");
  });

  it("accepts an other region and a PNG", () => {
    const parsed = parseTenantVerification({
      ...valid,
      licenseRegion: "OTHER",
      licenseRegionOther: "Scotland",
      idPhoto: photo(64, "png"),
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.licenseRegion).toBe("Scotland");
    expect(parsed.value.fileName).toBe("drivers-license.png");
  });

  it("rejects a missing photo, an oversized photo, and a short license", () => {
    expect(parseTenantVerification({ ...valid, idPhoto: "" }).ok).toBe(false);
    expect(parseTenantVerification({ ...valid, idPhoto: photo(ID_PHOTO_MAX_BYTES + 10) }).ok).toBe(false);
    expect(parseTenantVerification({ ...valid, licenseNumber: "A1" }).ok).toBe(false);
    expect(parseTenantVerification({ ...valid, addr1: "" }).ok).toBe(false);
  });

  it("keeps the reserve form free of driver's license and ID upload", () => {
    const src = readFileSync("src/app/(site)/units/[location]/[unitId]/HoldForm.tsx", "utf8");
    expect(src).not.toMatch(/idPhoto|licenseNumber|driver/i);
  });
});

describe("move-in steps", () => {
  it("explains verify, SiteLink eSign, and Nokē or Haley access", () => {
    const text = MOVE_IN_STEPS.map((s) => `${s.title} ${s.detail}`).join(" ");
    expect(text).toMatch(/Verify ID & address \+ pay/i);
    expect(text).toMatch(/28-day charge or prepaid package/i);
    expect(text).toMatch(/SiteLink eSign lease/i);
    expect(text).toMatch(/emailed to you/i);
    expect(text).toMatch(/Nokē Smart Entry/);
    expect(text).toMatch(/Addington Forks and Stellarton/);
    expect(text).toMatch(/Haley Road/);
  });
});
