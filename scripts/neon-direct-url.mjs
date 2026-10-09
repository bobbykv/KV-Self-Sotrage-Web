#!/usr/bin/env node
/**
 * Neon pooled URLs (…-pooler…neon.tech) cannot run Prisma migrate (advisory locks).
 * Print a direct URL by removing "-pooler" from the host.
 *
 * Usage:
 *   node scripts/neon-direct-url.mjs
 *   DATABASE_URL='postgresql://…pooler…' node scripts/neon-direct-url.mjs
 */

const raw = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";
if (!raw) {
  console.error("Set DATABASE_URL or DIRECT_DATABASE_URL (Neon connection string).");
  process.exit(1);
}

let url;
try {
  url = new URL(raw.replace(/^postgresql:/, "postgres:"));
} catch {
  console.error("Could not parse DATABASE_URL.");
  process.exit(1);
}

if (!url.hostname.includes("neon.tech")) {
  console.warn("Warning: host does not look like Neon; using URL as-is.");
  console.log(raw);
  process.exit(0);
}

if (url.hostname.includes("-pooler")) {
  url.hostname = url.hostname.replace("-pooler", "");
}

const out = url.toString().replace(/^postgres:/, "postgresql:");
console.log(out);
