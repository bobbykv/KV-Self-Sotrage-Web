import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  config: {
    appTestMode: true, ghlLiveLeadsInTestMode: true,
    GHL_API_KEY: "example-test-token", GHL_LOCATION_ID: "nGDJgf5wtNXdc5NWsm0z",
    GHL_WEBHOOK_URL: undefined as string | undefined,
    GHL_STORAGE_PIPELINE_ID: undefined, GHL_STORAGE_STAGE_ID: undefined,
  },
  lead: { id: "audit-lead", name: "AUDIT TEST Website", phone: "9025550100", email: "audit-test@example.com", channel: "website_form", reason: "waitlist", locationKey: "hwy4", unitType: "Drive-up", unitSize: "5x10", notes: "AUDIT TEST", createdAt: new Date("2026-11-06T12:00:00Z"), externalId: null },
}));
vi.mock("@/lib/env", () => ({ env: state.config }));
vi.mock("@/lib/db", () => ({ db: { lead: {
  findUniqueOrThrow: vi.fn(async () => state.lead),
  update: vi.fn(async ({ data }) => ({ ...state.lead, ...data })),
} } }));
vi.mock("@/lib/notify", () => ({ notifyStaff: vi.fn(async () => {}) }));
import { sendLeadToGhl } from "@/lib/leads";

describe("website lead delivery to GoHighLevel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.config.ghlLiveLeadsInTestMode = true;
    state.config.GHL_WEBHOOK_URL = undefined;
  });
  it("sends the contact, detailed note and Storage opportunity while rental testing stays on", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ contact: { id: "crm-contact" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    const saved = await sendLeadToGhl("audit-lead");
    expect(saved.ghlStatus).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(4);
    const contact = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(contact.tags).toBeUndefined();
    expect(fetch.mock.calls[1][0]).toBe("https://services.leadconnectorhq.com/contacts/crm-contact/tags");
    const added = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(added.tags).toContain("storage lead");
    expect(added.tags).toContain("reason:waitlist");
    expect(String(fetch.mock.calls[2][1]?.body)).toContain("Website lead reference: audit-lead");
    expect(JSON.parse(String(fetch.mock.calls[3][1]?.body))).toMatchObject({ contactId: "crm-contact", status: "open" });
    expect(state.config.appTestMode).toBe(true);
  });
  it.each(["tags", "notes", "opportunity"])("retains a failed lead for retry if %s delivery is rejected", async (step) => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ contact: { id: "crm-contact" } }), { status: 201 }));
    if (step !== "tags") fetch.mockResolvedValueOnce(new Response("{}", { status: 201 }));
    if (step === "opportunity") fetch.mockResolvedValueOnce(new Response("{}", { status: 201 }));
    fetch.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const saved = await sendLeadToGhl("audit-lead");
    expect(saved.ghlStatus).toBe("failed");
    expect(saved.ghlError).toContain("HTTP 403");
  });
  it("does not mark delivery sent if contact upsert returns no contact ID", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const saved = await sendLeadToGhl("audit-lead");
    expect(saved.ghlStatus).toBe("failed");
    expect(saved.ghlError).toContain("no contact ID");
  });
  it("makes no external requests in ordinary rental test mode", async () => {
    state.config.ghlLiveLeadsInTestMode = false;
    const fetch = vi.spyOn(globalThis, "fetch");
    expect((await sendLeadToGhl("audit-lead")).ghlStatus).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });
});
