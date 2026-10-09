import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  leadFromRetellSession,
  parseRetellWebhook,
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
    expect(lead?.notes).toContain("Summary: Visitor wants a 10x10 at Haley Road.");
    expect(lead?.notes).not.toContain("Transcript:");
  });

  it("returns null contact when no phone or email", () => {
    const { session } = parseRetellWebhook({
      event: "chat_ended",
      chat: { chat_id: "chat_x", transcript: "just browsing sizes" },
    });
    expect(leadFromRetellSession(session!)).toBeNull();
  });

  it("does not mistake the agent's KV phone number for a visitor contact", () => {
    const { session } = parseRetellWebhook({
      event: "chat_analyzed",
      chat: {
        chat_id: "chat_no_contact",
        transcript: "Agent: Call KV at 902-867-3779.\nUser: Thanks, I will browse first.",
        transcript_object: [
          { role: "agent", content: "Call KV at 902-867-3779." },
          { role: "user", content: "Thanks, I will browse first." },
        ],
        chat_analysis: { chat_summary: "Visitor is browsing storage sizes." },
      },
    });
    expect(leadFromRetellSession(session!)).toBeNull();
  });

  it("uses the customer number for an outbound call", () => {
    const { session } = parseRetellWebhook({
      event: "call_analyzed",
      call: {
        call_id: "call_outbound",
        direction: "outbound",
        from_number: "+19028673779",
        to_number: "+19025551212",
        retell_llm_dynamic_variables: { from_number: "+19028673779" },
        call_analysis: { call_summary: "Customer asked about a unit." },
      },
    });
    expect(leadFromRetellSession(session!)).toMatchObject({ phone: "+19025551212" });
  });

  it("reads collected contact variables when ordinary dynamic variables are empty", () => {
    const { session } = parseRetellWebhook({
      event: "chat_analyzed",
      chat: {
        chat_id: "chat_collected",
        retell_llm_dynamic_variables: {},
        collected_dynamic_variables: { name: "Alex Smith", phone: "9025553434" },
        chat_analysis: { chat_summary: "Alex asked for a small unit." },
      },
    });
    expect(leadFromRetellSession(session!)).toMatchObject({ name: "Alex Smith", phone: "9025553434" });
  });

  it("keeps freeform custom text out of the GHL summary note", () => {
    const { session } = parseRetellWebhook({
      event: "chat_analyzed",
      chat: {
        chat_id: "chat_private",
        collected_dynamic_variables: { name: "Alex Smith", phone: "9025553434" },
        chat_analysis: {
          chat_summary: "Alex asked for a small unit.",
          custom_analysis_data: { notes: "Full conversation: private details." },
        },
      },
    });
    expect(leadFromRetellSession(session!)?.notes).toContain("Summary: Alex asked for a small unit.");
    expect(leadFromRetellSession(session!)?.notes).not.toContain("Full conversation");
  });

  it("syncs only analyzed events so ended and analyzed do not create duplicate deliveries", () => {
    expect(shouldSyncRetellEvent("chat_ended")).toBe(false);
    expect(shouldSyncRetellEvent("call_ended")).toBe(false);
    expect(shouldSyncRetellEvent("chat_analyzed")).toBe(true);
    expect(shouldSyncRetellEvent("call_analyzed")).toBe(true);
  });
});
