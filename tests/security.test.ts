import { describe, expect, it } from "vitest";
import { cardBrand, luhnValid, parseExpiry } from "@/lib/card";
import { passwordProblems } from "@/lib/password-policy";
import { redact, redactString } from "@/lib/redact";

describe("redaction", () => {
  it("removes card numbers from free text", () => {
    expect(redactString("card 4242 4242 4242 4242 declined")).not.toMatch(/4242/);
    expect(redactString("pan=4111-1111-1111-1111")).not.toMatch(/1111-1111/);
  });

  it("removes sensitive SOAP elements", () => {
    const out = redactString("<sCreditCardNumber>4242424242424242</sCreditCardNumber><sCreditCardCVV>123</sCreditCardCVV><sCorpPassword>pw</sCorpPassword><sUnitName>A01</sUnitName>");
    expect(out).not.toMatch(/4242|>123<|>pw</);
    expect(out).toContain("<sUnitName>A01</sUnitName>");
  });

  it("redacts sensitive keys but keeps harmless ones", () => {
    const out = redact({ cardNumber: "4242424242424242", cvv: "123", expiry: "12/30", password: "x", sAccessCode: "1234", sCompany: "KV", nested: { token: "t" } }) as Record<string, unknown>;
    expect(out.cardNumber).toBe("[REDACTED]");
    expect(out.cvv).toBe("[REDACTED]");
    expect(out.expiry).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.sAccessCode).toBe("1234");
    expect(out.sCompany).toBe("KV");
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("redacts Error messages", () => {
    expect(JSON.stringify(redact(new Error("failed for 4242424242424242")))).not.toMatch(/4242424242424242/);
  });
});

describe("card helpers", () => {
  it("validates Luhn", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("4242424242424241")).toBe(false);
  });

  it("detects brands", () => {
    expect(cardBrand("4242424242424242")).toBe("visa");
    expect(cardBrand("5555555555554444")).toBe("mastercard");
    expect(cardBrand("378282246310005")).toBe("amex");
  });

  it("parses expiry and rejects past dates", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    expect(parseExpiry("12/30", now)?.getUTCFullYear()).toBe(2030);
    expect(parseExpiry("01/2026", now)).toBeNull();
    expect(parseExpiry("13/30", now)).toBeNull();
  });
});

describe("staff password policy", () => {
  it("accepts a strong password", () => {
    expect(passwordProblems("Kv-Storage-Demo-2026!", "owner@kvselfstorage.ca")).toEqual([]);
  });

  it("rejects short, simple or email-derived passwords", () => {
    expect(passwordProblems("short1A!")).not.toEqual([]);
    expect(passwordProblems("alllowercaseletters")).not.toEqual([]);
    expect(passwordProblems("Jane.Doe-2026!", "jane.doe@example.com")).not.toEqual([]);
  });
});
