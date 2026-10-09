import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  leadFromRetellSession,
  parseRetellWebhook,
  retellGhlPayload,
  shouldSyncRetellEvent,
  verifyRetellSignature,
} from "@/lib/retell-webhook";

describe("verifyRetellSignature", () => {
  it("accepts a fresh valid signature", () => {
    const raw = '{"event":"chat_ended"}';
    const apiKey = "key_test_secret";
    const ts = Date.now();
    const digest = createHmac("sha256", apiKey).update(raw + String(ts)).digest("hex");
    expect(verifyRetellSignature(raw, apiKey, `v=${ts},d=${digest}`, ts)).toBe(true);
  });

  it("rejects bad digests and stale timestamps", () => {
    const raw = '{"event":"chat_ended"}';
    const apiKey = "key_test_secret";
    const ts = Date.now();
    expect(verifyRetellSignature(raw, apiKey, `v=${ts},d=deadbeef`, ts)).toBe(false);
    const old = ts - 10 * 60_000;
    const digest = createHmac("sha256", apiKey).update(raw + String(old)).digest("hex");
    expect(verifyRetellSignature(raw, apiKey, `v=${old},d=${digest}`, ts)).toBe(false);
  });
});

describe("parseRetellWebhook + lead extraction", () => {
  it("builds a GHL-ready contact from chat_analyzed", () => {
    const { event, session } = parseRetellWebhook({
      event: "chat_analyzed",
      chat: {
        chat_id: "chat_abc",
        agent_id: "agent_1",
        transcript: "Agent: Hi\nUser: I'm Jane Doe, 902-555-1212, need a 10x10 at Haley.",
        chat_analysis: {
          chat_summary: "Visitor wants a 10x10 at Haley Road.",
          user_sentiment: "Positive",
          custom_analysis_data: {
            name: "Jane Doe",
            phone: "9025551212",
            email: "jane@example.com",
            location: "haley",
            unit_size: "10x10",
            reason: "contact_request",
          },
        },
      },
    });
    expect(event).toBe("chat_analyzed");
    expect(session?.id).toBe("chat_abc");
    expect(shouldSyncRetellEvent(event)).toBe(true);
    const lead = leadFromRetellSession(session!);
    expect(lead).toMatchObject({
      channel: "website_chat",
      name: "Jane Doe",
      phone: "9025551212",
      email: "jane@example.com",
      locationKey: "haley",
      unitSize: "10x10",
    });
    expect(lead?.notes).toContain("Transcript:");
    const payload = retellGhlPayload(event, session!);
    expect(payload.source).toBe("retell");
    expect(payload.contact?.email).toBe("jane@example.com");
    expect(payload.transcript).toContain("Jane Doe");
  });

  it("returns null contact when no phone or email", () => {
    const { session } = parseRetellWebhook({
      event: "chat_ended",
      chat: { chat_id: "chat_x", transcript: "just browsing sizes" },
    });
    expect(leadFromRetellSession(session!)).toBeNull();
  });
});
