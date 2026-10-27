import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeLicenseScans, normalizeLicenseScan, parseLicenseOcr } from "@/lib/license-scan";

const NS_CARD = `
NOVA SCOTIA
CANADA
DRIVER'S LICENCE
SMITH-12345-67890
12 MAIN STREET
ANTIGONISH NS B2G 1A1
`;

describe("licence photo reading", () => {
  it("reads a Nova Scotia licence number, street, city, and postal code", () => {
    expect(parseLicenseOcr(NS_CARD)).toMatchObject({
      licenseNumber: "SMITH-12345-67890",
      licenseRegion: "NS",
      addressLine1: "12 Main Street",
      city: "Antigonish",
      postalCode: "B2G 1A1",
    });
  });

  it("reads the same card from one line and a dashed-less number", () => {
    const scan = parseLicenseOcr("NOVA SCOTIA SMITH1234567890 12 MAIN STREET ANTIGONISH NS B2G1A1");
    expect(scan.licenseNumber).toBe("SMITH-12345-67890");
    expect(scan.postalCode).toBe("B2G 1A1");
    expect(scan.addressLine1).toBe("12 Main Street");
    expect(scan.city).toBe("Antigonish");
  });

  it("reads a US licence without treating the postal code as the number", () => {
    const scan = parseLicenseOcr("CALIFORNIA\nDL D1234567\n123 MAIN ST\nLOS ANGELES CA 90001");
    expect(scan.licenseNumber).toBe("D1234567");
    expect(scan.licenseRegion).toBe("CA");
    expect(scan.city).toBe("Los Angeles");
    expect(scan.postalCode).toBe("90001");
    expect(scan.addressLine1).toMatch(/123 Main St/i);
  });

  it("normalizes a vision payload and lets the server result fill gaps", () => {
    const vision = normalizeLicenseScan({
      licenseNumber: "MACDO-11111-22222",
      licenseRegion: "Nova Scotia",
      addressLine1: "4 Church Street",
      city: "Stellarton",
      postalCode: "b0k1s0",
    });
    expect(vision).toMatchObject({
      licenseNumber: "MACDO-11111-22222",
      licenseRegion: "NS",
      city: "Stellarton",
      postalCode: "B0K 1S0",
    });
    expect(mergeLicenseScans({ ...vision, city: null }, parseLicenseOcr("NEW GLASGOW NS")).city).toBe("New Glasgow");
  });

  it("puts the licence photo first on checkout and shows the scanning and verify states", () => {
    const src = readFileSync("src/app/(site)/checkout/[holdId]/VerificationFields.tsx", "utf8");
    expect(src.indexOf("Snap a photo of your driver's license")).toBeLessThan(src.indexOf('name="licenseNumber"'));
    expect(src).toContain("Scanning license to auto-fill your info…");
    expect(src).toContain("Auto-filled from your ID — please verify");
    expect(src).toContain("/api/checkout/scan-license");
  });
});