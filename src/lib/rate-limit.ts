import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { log, safeErrorMessage } from "./log";

/**
 * Fixed-window limiter stored in Postgres so it works across serverless
 * instances. Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" = ${windowStart} THEN "RateLimit"."count" + 1 ELSE 1 END,
        "windowStart" = ${windowStart}
      RETURNING "count"`;
    return (rows[0]?.count ?? 1) <= limit;
  } catch (err) {
    log.warn("rate limit skipped", { err: safeErrorMessage(err) });
    return true;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
