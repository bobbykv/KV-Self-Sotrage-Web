import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { captureLead } from "@/lib/leads";
import { leadFromRetellSession, syncRetellSessionToGhl, type RetellSession } from "@/lib/retell-webhook";

vi.mock("@/lib/env", () => ({ env: { appTestMode: false } }));
vi.mock("@/lib/db", () => ({ db: { lead: { findFirst: vi.fn() } } }));
vi.mock("@/lib/leads", () => ({ captureLead: vi.fn() }));

const session: RetellSession = {
  kind: "chat",
  id: "chat-1",
  channel: "website_chat",
  transcript: "User: My name is Jane Doe. I need storage in November.",
  summary: "Jane needs a 10x10 unit in November.",
  custom: { name: "Jane Doe", email: "jane@example.com", location: "haley" },
};

beforeEach(() => vi.clearAllMocks());

describe("Retell analyzed delivery", () => {
  it("saves the summary without sending the transcript", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue(null);
    vi.mocked(captureLead).mockResolvedValue({ id: "lead-1", ghlStatus: "sent" } as never);

    const result = await syncRetellSessionToGhl("chat_analyzed", session);

    expect(result).toMatchObject({ ok: true, leadId: "lead-1", ghlStatus: "sent" });
    const input = vi.mocked(captureLead).mock.calls[0][0];
    expect(input.externalId).toBe("retell:chat:chat-1");
    expect(input.notes).toContain("Summary: Jane needs a 10x10 unit in November.");
    expect(input.notes).not.toContain("My name is Jane Doe");
  });

  it("reports a failed GHL delivery so Retell can retry", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue(null);
    vi.mocked(captureLead).mockResolvedValue({ id: "lead-1", ghlStatus: "failed" } as never);

    const result = await syncRetellSessionToGhl("chat_analyzed", session);

    expect(result).toMatchObject({ ok: false, leadId: "lead-1", ghlStatus: "failed" });
  });

  it("does not create a second note for a repeated analyzed event", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue({
      id: "lead-1",
      ghlStatus: "sent",
      notes: leadFromRetellSession(session)?.notes,
    } as never);

    const result = await syncRetellSessionToGhl("chat_analyzed", session);

    expect(result).toMatchObject({ ok: true, deduped: true });
    expect(captureLead).not.toHaveBeenCalled();
  });

  it("keeps a tool-captured contact ahead of a number guessed from user text", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue({
      id: "lead-1",
      channel: "website_chat",
      reason: "contact_request",
      name: "Jane Doe",
      phone: "9025551212",
      email: "jane@example.com",
      locationKey: "haley",
      unitType: null,
      unitSize: null,
      ghlStatus: "sent",
      notes: "Initial request",
    } as never);
    vi.mocked(captureLead).mockResolvedValue({ id: "lead-1", ghlStatus: "sent" } as never);

    await syncRetellSessionToGhl("chat_analyzed", {
      ...session,
      custom: {},
      userText: "I might be reachable at 9025559999 instead.",
    });

    expect(vi.mocked(captureLead).mock.calls[0][0]).toMatchObject({
      name: "Jane Doe",
      phone: "9025551212",
      email: "jane@example.com",
    });
  });
});
