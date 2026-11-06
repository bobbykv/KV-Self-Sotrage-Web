import { describe, expect, it, vi } from "vitest";
import { migrationDatabaseUrl, runProductionMigrations } from "../scripts/migrate-production.mjs";

describe("production migration connection", () => {
  it("uses Neon's direct host while preserving authentication and TLS", () => {
    const url = new URL(migrationDatabaseUrl({ DATABASE_URL: "postgresql://test:example@ep-example-pooler.us-east-1.aws.neon.tech/kv?sslmode=require&pgbouncer=true" }));
    expect(url.hostname).toBe("ep-example.us-east-1.aws.neon.tech");
    expect(url.password).toBe("example");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.has("pgbouncer")).toBe(false);
    expect(url.searchParams.get("connect_timeout")).toBe("30");
  });
  it("prefers an explicitly configured direct connection", () => {
    expect(migrationDatabaseUrl({ DIRECT_URL: "postgresql://test:example@localhost:5432/direct", DATABASE_URL: "postgresql://test:example@localhost:5432/pooled" })).toContain("/direct");
  });
  it("does not require a database or run migrations on preview or local builds", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => runProductionMigrations({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => runProductionMigrations({})).not.toThrow();
    spy.mockRestore();
  });
});
