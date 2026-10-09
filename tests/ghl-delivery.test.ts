import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ghlPayload, sendLeadToGhl, upsertGhlContact } from "@/lib/leads";

vi.mock("@/lib/env", () => ({
  env: {
    appTestMode: false,
    GHL_API_KEY: "test-token",
    GHL_LOCATION_ID: "test-location",
    GHL_WEBHOOK_URL: undefined,
  },
}));
vi.mock("@/lib/db", () => ({
  db: { lead: { findUniqueOrThrow: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/notify", () => ({ notifyStaff: vi.fn() }));
vi.mock("@/lib/log", () => ({
  log: { warn: vi.fn() },
  safeErrorMessage: (err: unknown) => err instanceof Error ? err.message : String(err),
}));

const lead = {
  id: "lead-1",
  channel: "retell" as const,
  reason: "contact_request" as const,
  name: "Jane Doe",
  phone: "9025551212",
  email: "jane@example.com",
  locationKey: "haley" as const,
  unitType: "Drive-up",
  unitSize: "10x10",
  notes: "Summary: Looking for storage next month.",
  createdAt: new Date("2026-10-08T20:00:00.000Z"),
};

function jsonBody(call: readonly unknown[]) {
  return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
}

afterEach(() => vi.restoreAllMocks());

describe("GHL API contact delivery", () => {
  it("upserts without replacing tags, adds KV tags, then creates a summary note", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ contact: { id: "contact-1" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tags: ["existing", "kv-self-storage"] }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ note: { id: "note-1" } }), { status: 201 }));

    await upsertGhlContact(ghlPayload(lead));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/contacts/upsert");
    expect(jsonBody(fetchMock.mock.calls[0])).not.toHaveProperty("tags");
    expect(fetchMock.mock.calls[1][0]).toBe("https://services.leadconnectorhq.com/contacts/contact-1/tags");
    expect(jsonBody(fetchMock.mock.calls[1]).tags).toContain("kv-self-storage");
    expect(fetchMock.mock.calls[2][0]).toBe("https://services.leadconnectorhq.com/contacts/contact-1/notes");
    expect(jsonBody(fetchMock.mock.calls[2]).body).toContain("Summary: Looking for storage next month.");
    expect(jsonBody(fetchMock.mock.calls[2]).body).not.toContain("Transcript:");
  });

  it("does not report delivery when GHL rejects the note", async () => {
    vi.mocked(db.lead.findUniqueOrThrow).mockResolvedValue(lead as never);
    vi.mocked(db.lead.update).mockImplementation(async ({ data }) => ({ ...lead, ...data }) as never);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ contact: { id: "contact-1" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));

    const saved = await sendLeadToGhl(lead.id);

    expect(saved.ghlStatus).toBe("failed");
    expect(saved.ghlError).toContain("GHL contacts/notes HTTP 403");
    expect(db.lead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ghlStatus: "failed" }),
    }));
  });
});
