import "server-only";
import { db } from "./db";

/**
 * Cross-instance mutex backed by the Setting table, so overlapping cron runs
 * (or a cold-start refresh racing a cron) don't double-spend SiteLink calls.
 */
export async function withJobLock<T>(name: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T | null> {
  const key = `lock:${name}`;
  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const acquired = await db.$executeRaw`
    INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES (${key}, jsonb_build_object('until', ${until}::text), now())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
    WHERE ("Setting"."value"->>'until')::timestamptz < now()`;
  if (acquired === 0) return null;
  try {
    return await fn();
  } finally {
    await db.setting.delete({ where: { key } }).catch(() => undefined);
  }
}
