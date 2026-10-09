import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureLead } from "@/lib/leads";
import { runTool } from "@/lib/chat/tools";

vi.mock("@/lib/leads", () => ({ captureLead: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("capture_lead tool response", () => {
  it("distinguishes a locally saved lead from confirmed GHL delivery", async () => {
    vi.mocked(captureLead).mockResolvedValue({ id: "lead-1", ghlStatus: "failed" } as never);

    const result = await runTool("capture_lead", { reason: "contact_request", name: "Jane Doe", email: "jane@example.com" }, "retell");

    expect(result).toMatchObject({ ok: true, lead_id: "lead-1", ghl_status: "failed" });
    expect(result.message).not.toContain("sent to GoHighLevel");
  });
});
