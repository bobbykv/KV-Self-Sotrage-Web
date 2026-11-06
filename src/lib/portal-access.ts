import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { after } from "next/server";
import { isLocationKey } from "@/config/locations";
import { db } from "./db";
import { env } from "./env";
import { log } from "./log";
import { clientIp, rateLimit } from "./rate-limit";
import { sitelink } from "./sitelink/client";
const KIND = "portal-password";
export const ACCESS_MESSAGE = "If those details match your rental, we’ll email you a link. Check your inbox and spam folder. If it doesn’t arrive, call (902) 867-3779.";
const INVALID = "This link is invalid, expired, or already used. Please request a new link.";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenId = (token: string) => digest(`${KIND}:${token}`);
const normal = (email: string) => email.trim().toLowerCase();
export function accessOrigin() {
  const url = new URL(env.APP_URL);
  if (env.isProd && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Account email origin is not configured");
  return url.origin;
}
/** Transactional email only; do not overwrite names/phones, tag leads, or create opportunities. */
export async function sendAccessEmail(email: string, url: string) {
  if (env.appTestMode || env.sitelinkMode !== "live" || !env.GHL_API_KEY || !env.GHL_LOCATION_ID) throw new Error("Account email unavailable");
  const headers = { Authorization: `Bearer ${env.GHL_API_KEY}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };
  const result = await fetch("https://services.leadconnectorhq.com/contacts/upsert", { method: "POST", headers, body: JSON.stringify({ locationId: env.GHL_LOCATION_ID, email }), signal: AbortSignal.timeout(15000) });
  if (!result.ok) throw new Error("Account email contact unavailable");
  const contact = (await result.json()).contact;
  if (!contact?.id || normal(contact.email ?? "") !== email || contact.locationId !== env.GHL_LOCATION_ID) throw new Error("Account email recipient mismatch");
  const sent = await fetch("https://services.leadconnectorhq.com/conversations/messages", { method: "POST", headers,
    body: JSON.stringify({ type: "Email", contactId: contact.id, emailTo: email, subject: "Set your KV Self Storage account password", html: `<p>You requested online access or a password reset for KV Self Storage.</p><p><a href="${url}">Choose your account password</a></p><p>This link expires in 30 minutes and can be used once. If you didn’t request this, ignore this email. Your password has not changed.</p><p>Need help? Call (902) 867-3779.</p>` }), signal: AbortSignal.timeout(15000) });
  if (!sent.ok || !(await sent.json()).messageId) throw new Error("Account email was not accepted");
}
export async function requestPortalAccess(form: FormData) {
  const email = normal(String(form.get("email") ?? ""));
  const location = String(form.get("location") ?? "");
  const unit = String(form.get("unit") ?? "").trim();
  if (!z.email().max(254).safeParse(email).success || !isLocationKey(location) || !unit || unit.length > 40) return { error: "Enter your location, unit number, and the email on your rental." };
  if (!(await rateLimit(`portal-access-ip:${await clientIp()}`, 10, 3600, true)) || !(await rateLimit(`portal-access-email:${digest(email)}`, 3, 3600, true))) return { error: "Too many requests. Please try again later or call (902) 867-3779." };
  if (env.appTestMode || env.sitelinkMode !== "live" || !env.GHL_API_KEY || !env.GHL_LOCATION_ID) return { error: "Online access emails are temporarily unavailable. Please call (902) 867-3779." };
  // Keep response timing independent of whether the account exists. Next waits
  // for this background task after sending the generic form response.
  after(() => issuePortalAccess(email, location, unit));
  return { ok: true, message: ACCESS_MESSAGE };
}
async function issuePortalAccess(email: string, location: import("@/config/locations").LocationKey, unit: string) {
  let id: string | undefined;
  try {
    const origin = accessOrigin();
    const tenantId = await sitelink.tenantIdByUnitName(location, unit);
    if (!tenantId || tenantId <= 0) return;
    const info = await sitelink.tenantInfo(location, tenantId);
    if (!info || normal(info.tenant.email) !== email) return;
    const token = randomBytes(32).toString("base64url"); id = tokenId(token);
    // Existing Session storage supports hashed expiring credentials. Purpose and
    // hash namespace are separate from login cookies; no migration is needed.
    await db.session.create({ data: { id, kind: KIND, email, tenantData: { location, tenantId }, expiresAt: new Date(Date.now() + 30 * 60000) } });
    await sendAccessEmail(email, `${origin}/account-password?token=${token}`);
  } catch {
    if (id) await db.session.deleteMany({ where: { id, kind: KIND } }).catch(() => undefined);
    log.warn("portal access email could not be issued");
    // Never disclose matches or log email contents, credentials, or raw links.
  }
}
export async function completePortalAccess(form: FormData) {
  const token = String(form.get("token") ?? ""), password = String(form.get("password") ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: INVALID };
  if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: "Use 12–128 characters, including a letter and a number." };
  if (password !== String(form.get("confirmPassword") ?? "")) return { error: "The passwords don’t match." };
  if (!(await rateLimit(`portal-password:${await clientIp()}`, 10, 900, true))) return { error: "Too many attempts. Please try again later." };
  try {
    const id = tokenId(token), session = await db.session.findUnique({ where: { id } });
    if (!session || session.kind !== KIND || session.expiresAt <= new Date() || !session.email) return { error: INVALID };
    const identity = session.tenantData as { location?: string; tenantId?: number } | null;
    if (!identity || !isLocationKey(identity.location) || !Number.isInteger(identity.tenantId) || identity.tenantId! <= 0) return { error: INVALID };
    const location = identity.location, tenantId = identity.tenantId!;
    // Recheck SiteLink: an old link must not work after the rental email changes.
    const info = await sitelink.tenantInfo(location, tenantId);
    if (!info || normal(info.tenant.email) !== session.email) return { error: INVALID };
    const claimed = await db.$transaction(async tx => {
      const consumed = await tx.session.deleteMany({ where: { id, kind: KIND, expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) return false;
      await tx.session.deleteMany({ where: { email: session.email, kind: { in: [KIND, "tenant"] } } });
      return true;
    });
    if (!claimed) return { error: INVALID };
    await sitelink.setPortalPassword(location, tenantId, session.email, password);
    return { ok: true, message: "Your password is set. You can now sign in with your rental email and new password." };
  } catch { return { error: "We couldn’t finish setting your password. Request a fresh link or call (902) 867-3779." }; }
}
