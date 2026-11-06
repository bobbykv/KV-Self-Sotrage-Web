import { beforeEach, describe, expect, it, vi } from "vitest";
const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/leads", async (original) => ({ ...await original<typeof import("@/lib/leads")>(), captureLead: capture }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: async () => "audit", rateLimit: async () => true }));
import { POST } from "@/app/api/leads/route";

function request(reason: string) {
  return new Request("https://example.com/api/leads", { method: "POST", body: JSON.stringify({ channel: "website_form", reason, name: "AUDIT TEST", phone: "9025550100", email: "audit-test@example.com" }) });
}
describe("contact and waitlist persistence", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["contact_request", "waitlist"])("returns a receipt only after saving %s", async (reason) => {
    capture.mockResolvedValue({ id: "audit-reference", reason, ghlStatus: "sent" });
    const res = await POST(request(reason));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reference: "audit-reference" });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ reason, name: "AUDIT TEST" }));
  });
  it("returns a usable JSON error when storage fails, without claiming success", async () => {
    capture.mockRejectedValue(new Error("database unavailable"));
    const res = await POST(request("contact_request"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: expect.stringContaining("Your details are still here") });
  });
});
