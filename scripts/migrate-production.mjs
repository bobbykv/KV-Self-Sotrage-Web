import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/** Neon migrations need its direct host, not the transaction pooler. */
export function migrationDatabaseUrl(env) {
  const value = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
  if (!value) throw new Error("A database connection is required for production migrations.");
  const url = new URL(value);
  if (url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
    url.searchParams.delete("pgbouncer");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "30");
  }
  return url.toString();
}

/** @param {Record<string, string | undefined>} [env] */
export function runProductionMigrations(env = process.env) {
  if (env.VERCEL_ENV !== "production") {
    console.log("Production migrations skipped outside a production deployment.");
    return;
  }
  let connection;
  try { connection = migrationDatabaseUrl(env); }
  catch { throw new Error("Production migration connection is missing or invalid."); }
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...env, DATABASE_URL: connection }, encoding: "utf8", timeout: 180_000,
  });
  // Do not echo Prisma output: it can include connection details on errors.
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    const code = output.match(/\bP\d{4}\b/)?.[0] ?? "migration process failure";
    throw new Error(`Production migrations failed (${code}); deployment stopped.`);
  }
  const applied = [...output.matchAll(/Applying migration `([a-zA-Z0-9_]+)`/g)].map((m) => m[1]);
  console.log(`Production migrations complete. Applied: ${applied.join(", ") || "none (already current)"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runProductionMigrations(); }
  catch (err) { console.error(err.message); process.exitCode = 1; }
}
