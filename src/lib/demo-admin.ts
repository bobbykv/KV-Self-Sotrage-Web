import "server-only";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { env } from "./env";
import { log } from "./log";

/** Fixed staff login for APP_TEST_MODE only — never used when test mode is off. */
export const DEMO_ADMIN = {
  email: "owner@kvselfstorage.ca",
  password: "Kv-Storage-Demo-2026!",
  name: "Demo Owner",
} as const;

const g = globalThis as unknown as { __kvDemoAdminReady?: boolean };

/**
 * Ensures the demo owner account exists with the published test password.
 * No-op outside APP_TEST_MODE. Safe to call on every admin/testing page load
 * (result is cached per serverless instance after the first successful ensure).
 */
export async function ensureDemoAdmin(): Promise<void> {
  if (!env.appTestMode) return;
  if (g.__kvDemoAdminReady) return;
  try {
    const email = DEMO_ADMIN.email;
    const existing = await db.adminUser.findUnique({ where: { email } });
    if (!existing) {
      await db.adminUser.create({
        data: {
          email,
          name: DEMO_ADMIN.name,
          role: "owner",
          passwordHash: await bcrypt.hash(DEMO_ADMIN.password, 12),
        },
      });
      log.info("created APP_TEST_MODE demo admin", { email });
    } else {
      const ok = await bcrypt.compare(DEMO_ADMIN.password, existing.passwordHash);
      if (!ok) {
        await db.adminUser.update({
          where: { id: existing.id },
          data: {
            passwordHash: await bcrypt.hash(DEMO_ADMIN.password, 12),
            failedLogins: 0,
            lockedUntil: null,
          },
        });
        log.info("reset APP_TEST_MODE demo admin password", { email });
      }
    }
    g.__kvDemoAdminReady = true;
  } catch (err) {
    log.warn("ensureDemoAdmin failed", { err });
  }
}

/** Test helper — clears the per-process ensure cache. */
export function resetDemoAdminCache() {
  delete g.__kvDemoAdminReady;
}
