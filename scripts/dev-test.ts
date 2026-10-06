/**
 * Local APP_TEST_MODE launcher: dedicated Postgres on 55432 + Next on 3001.
 * Does not touch any production DATABASE_URL.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TEST_URL = "postgresql://kv:kv@127.0.0.1:55432/kv_self_storage_test";

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForPostgres() {
  for (let i = 0; i < 60; i++) {
    const code = await run("docker", ["compose", "-f", "compose.test.yml", "exec", "-T", "postgres-test", "pg_isready", "-U", "kv", "-d", "kv_self_storage_test"], {
      ...process.env,
      DATABASE_URL: TEST_URL,
    });
    if (code === 0) return;
    await sleep(1000);
  }
  throw new Error("Test Postgres on port 55432 did not become ready");
}

async function main() {
  const up = await run("docker", ["compose", "-f", "compose.test.yml", "up", "-d"]);
  if (up !== 0) throw new Error("Failed to start compose.test.yml — is Docker Desktop running?");
  await waitForPostgres();

  const migrateEnv = { ...process.env, DATABASE_URL: TEST_URL, APP_TEST_MODE: "1" };
  const migrated = await run("npx", ["prisma", "migrate", "deploy"], migrateEnv);
  if (migrated !== 0) throw new Error("Test database migration failed");

  const nextEnv = {
    ...process.env,
    DATABASE_URL: TEST_URL,
    APP_TEST_MODE: "1",
    APP_URL: "http://localhost:3001",
    SITELINK_MODE: "mock",
    PAYMENT_MODE: "passthrough",
    // Ignore inherited live integration secrets for the local simulator.
    SITELINK_CORP_CODE: "",
    SITELINK_API_USERNAME: "",
    SITELINK_API_PASSWORD: "",
    SITELINK_LOCATION_CODES: "",
    GHL_WEBHOOK_URL: "",
    GHL_API_KEY: "",
    GHL_LOCATION_ID: "",
    NOTIFY_WEBHOOK_URL: "",
    PAY_ONLINE_URL: "",
    CHAT_LLM_API_KEY: "",
    PORT: "3001",
  };

  console.log("\nTest site: http://localhost:3001/testing");
  console.log("Portal:    demo@kvselfstorage.ca / demo1234\n");
  const code = await run("npx", ["next", "dev", "-H", "127.0.0.1", "-p", "3001"], nextEnv);
  process.exit(code);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
