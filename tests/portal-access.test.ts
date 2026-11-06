import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => {
  const session = { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() };
  return { jobs: [] as (() => Promise<void>)[], session, transaction: vi.fn(), rateLimit: vi.fn(), tenantInfo: vi.fn(), tenantId: vi.fn(), setPassword: vi.fn(),
    env: { APP_URL: "https://kv-self-storage-web.vercel.app", isProd: true, appTestMode: false, sitelinkMode: "live", GHL_API_KEY: "test", GHL_LOCATION_ID: "kv" } };
});
vi.mock("@/lib/db", () => ({ db: { session: mocks.session, $transaction: mocks.transaction } }));
vi.mock("next/server", () => ({ after: (job: () => Promise<void>) => mocks.jobs.push(job) }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, clientIp: async () => "test-ip" }));
vi.mock("@/lib/sitelink/client", () => ({ sitelink: { tenantIdByUnitName: mocks.tenantId, tenantInfo: mocks.tenantInfo, setPortalPassword: mocks.setPassword } }));
import { ACCESS_MESSAGE, accessOrigin, completePortalAccess, requestPortalAccess, sendAccessEmail } from "@/lib/portal-access";
const form = (data: Record<string, string>) => { const f = new FormData(); for (const [key,value] of Object.entries(data)) f.set(key,value); return f; };
const token = "a".repeat(43);
const request = () => form({ email: "Customer@Example.com", location: "haley", unit: "101" });
async function sendRequest() { const result = await requestPortalAccess(request()); for (const job of mocks.jobs.splice(0)) await job(); return result; }
const completion = () => form({ token, password: "My new password 123", confirmPassword: "My new password 123" });
describe("existing tenant online access", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.unstubAllGlobals(); mocks.jobs.length = 0;
    mocks.env.APP_URL = "https://kv-self-storage-web.vercel.app"; mocks.env.appTestMode = false;
    mocks.rateLimit.mockResolvedValue(true);
    mocks.tenantId.mockResolvedValue(42);
    mocks.tenantInfo.mockResolvedValue({ tenant: { email: "customer@example.com" } });
    mocks.session.create.mockResolvedValue({}); mocks.session.deleteMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async cb => cb({session:mocks.session}));
    mocks.session.findUnique.mockResolvedValue({kind:"portal-password",email:"customer@example.com",tenantData:{location:"haley",tenantId:42},expiresAt:new Date(Date.now()+60000)});
  });
  it("sends only to the exact SiteLink email and stores only a hash", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({contact:{id:"c",email:"customer@example.com",locationId:"kv"}}))).mockResolvedValueOnce(new Response(JSON.stringify({messageId:"m"})));
    vi.stubGlobal("fetch",fetch);
    expect(await sendRequest()).toEqual({ok:true,message:ACCESS_MESSAGE});
    const data=mocks.session.create.mock.calls[0][0].data;
    expect(data.id).toMatch(/^[a-f0-9]{64}$/);expect(data.kind).toBe("portal-password");
    const sent=JSON.parse(fetch.mock.calls[1][1].body);expect(sent.emailTo).toBe("customer@example.com");expect(sent.html).toContain("/account-password?token=");
    expect(data.expiresAt.getTime()-Date.now()).toBeLessThanOrEqual(1800000);
    expect(JSON.stringify(data)).not.toContain("?token=");
  });
  it("returns the same response on a mismatch without creating a token or sending",async()=>{
    mocks.tenantInfo.mockResolvedValue({tenant:{email:"someoneelse@example.com"}});const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    expect(await sendRequest()).toEqual({ok:true,message:ACCESS_MESSAGE});expect(fetch).not.toHaveBeenCalled();expect(mocks.session.create).not.toHaveBeenCalled();
  });
  it("blocks rate-limited requests before SiteLink lookup",async()=>{mocks.rateLimit.mockResolvedValue(false);expect(await sendRequest()).toHaveProperty("error");expect(mocks.tenantId).not.toHaveBeenCalled();});
  it("invalidates an unsent token when delivery fails",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("",{status:503})));await sendRequest();expect(mocks.session.deleteMany).toHaveBeenCalledWith({where:{id:expect.any(String),kind:"portal-password"}});});
  it("rejects recipient mismatches in the mail service",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({contact:{id:"c",email:"wrong@example.com",locationId:"kv"}}))));await expect(sendAccessEmail("customer@example.com","https://example.com")).rejects.toThrow("recipient mismatch");});
  it("consumes a valid token before updating only its bound tenant and revokes sessions",async()=>{
    expect(await completePortalAccess(completion())).toHaveProperty("ok",true);
    expect(mocks.session.findUnique).toHaveBeenCalledWith({where:{id:createHash("sha256").update(`portal-password:${token}`).digest("hex")}});
    expect(mocks.setPassword).toHaveBeenCalledWith("haley",42,"customer@example.com","My new password 123");
    expect(mocks.session.deleteMany).toHaveBeenCalledWith({where:{email:"customer@example.com",kind:{in:["portal-password","tenant"]}}});
  });
  it("rejects an expired token",async()=>{mocks.session.findUnique.mockResolvedValue({kind:"portal-password",email:"customer@example.com",expiresAt:new Date(0)});expect(await completePortalAccess(completion())).toHaveProperty("error");expect(mocks.setPassword).not.toHaveBeenCalled();});
  it("rejects a login session token or an already consumed token",async()=>{mocks.session.findUnique.mockResolvedValue({kind:"tenant",expiresAt:new Date(Date.now()+60000)});expect(await completePortalAccess(completion())).toHaveProperty("error");mocks.session.findUnique.mockResolvedValue(null);expect(await completePortalAccess(completion())).toHaveProperty("error");expect(mocks.setPassword).not.toHaveBeenCalled();});
  it("does not update SiteLink when a competing request consumed the token",async()=>{mocks.session.deleteMany.mockResolvedValue({count:0});expect(await completePortalAccess(completion())).toHaveProperty("error");expect(mocks.setPassword).not.toHaveBeenCalled();});
  it("rejects a link when the SiteLink email has changed",async()=>{mocks.tenantInfo.mockResolvedValue({tenant:{email:"changed@example.com"}});expect(await completePortalAccess(completion())).toHaveProperty("error");expect(mocks.transaction).not.toHaveBeenCalled();expect(mocks.setPassword).not.toHaveBeenCalled();});
  it("rejects a mismatched password confirmation",async()=>{const f=completion();f.set("confirmPassword","different");expect(await completePortalAccess(f)).toHaveProperty("error");expect(mocks.session.findUnique).not.toHaveBeenCalled();});
  it("blocks mail in simulator mode",async()=>{mocks.env.appTestMode=true;expect(await sendRequest()).toHaveProperty("error");expect(mocks.tenantId).not.toHaveBeenCalled();});
  it("rejects an insecure production origin",()=>{mocks.env.APP_URL="http://localhost:3000";expect(accessOrigin).toThrow();});
});

