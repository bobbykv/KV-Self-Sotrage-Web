import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@prisma/client";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { audit } from "./audit";
import { db } from "./db";
import { env } from "./env";
import { clientIp, rateLimit } from "./rate-limit";
import { sitelink } from "./sitelink/client";

const ADMIN_COOKIE = "kv_admin";
const TENANT_COOKIE = "kv_tenant";
const ADMIN_TTL_HOURS = 12;
const TENANT_TTL_HOURS = 2;
const LOCKOUT_AFTER = 5;
const LOCKOUT_MINUTES = 15;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function startSession(kind: "admin" | "tenant", ttlHours: number, data: { adminUserId?: string; tenantData?: TenantLink[]; email?: string }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  await db.session.create({
    data: { id: hashToken(token), kind, adminUserId: data.adminUserId, tenantData: data.tenantData, email: data.email, expiresAt },
  });
  (await cookies()).set(kind === "admin" ? ADMIN_COOKIE : TENANT_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function readSession(kind: "admin" | "tenant") {
  const token = (await cookies()).get(kind === "admin" ? ADMIN_COOKIE : TENANT_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: hashToken(token) }, include: { adminUser: true } });
  if (!s || s.kind !== kind || s.expiresAt < new Date()) return null;
  return s;
}

export async function endSession(kind: "admin" | "tenant") {
  const jar = await cookies();
  const name = kind === "admin" ? ADMIN_COOKIE : TENANT_COOKIE;
  const token = jar.get(name)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(name);
}

// ---------- Staff ----------

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

let dummyHash: string | undefined;

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function adminLogin(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const generic = "Email or password is incorrect.";
  if (!(await rateLimit(`admin-login:${ip}`, 10, 900))) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." };
  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
    await bcrypt.compare(password, dummyHash);
    return { ok: false, error: generic };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, error: "This account is temporarily locked. Try again in a few minutes." };
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db.adminUser.update({
      where: { id: user.id },
      data: { failedLogins: failed >= LOCKOUT_AFTER ? 0 : failed, lockedUntil: failed >= LOCKOUT_AFTER ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null },
    });
    await audit(user.email, "admin.login_failed", undefined, { ip });
    return { ok: false, error: generic };
  }
  await db.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await startSession("admin", ADMIN_TTL_HOURS, { adminUserId: user.id });
  await audit(user.email, "admin.login", undefined, { ip });
  return { ok: true };
}

export async function getAdmin(): Promise<AdminUser | null> {
  return (await readSession("admin"))?.adminUser ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

// ---------- Tenants (SiteLink identity) ----------

export type TenantLink = { locationKey: LocationKey; tenantId: number };

/**
 * Tenant login maps an email + web password to SiteLink TenantLogin. A person
 * may rent at more than one KV facility, so we try each location.
 */
export async function tenantLogin(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const normalized = email.trim().toLowerCase();
  if (!(await rateLimit(`tenant-login:${ip}`, 10, 900)) || !(await rateLimit(`tenant-login-email:${normalized}`, 6, 900))) {
    return { ok: false, error: "Too many attempts. Wait 15 minutes, or call (902) 867-3779." };
  }
  const links: TenantLink[] = [];
  for (const loc of LOCATION_KEYS) {
    const id = await sitelink.tenantLogin(loc, normalized, password).catch(() => null);
    if (id) links.push({ locationKey: loc, tenantId: id });
  }
  if (!links.length) return { ok: false, error: "We couldn't sign you in with that email and password." };
  await startSession("tenant", TENANT_TTL_HOURS, { tenantData: links, email: normalized });
  return { ok: true };
}

export async function getTenantSession(): Promise<{ email: string; links: TenantLink[] } | null> {
  const s = await readSession("tenant");
  if (!s) return null;
  return { email: s.email ?? "", links: (s.tenantData as TenantLink[]) ?? [] };
}

export async function requireTenant() {
  const s = await getTenantSession();
  if (!s) redirect("/portal/login");
  return s;
}
