import "server-only";

/** True when APP_TEST_MODE=1 — hosted/local simulator that must never touch live integrations. */
export function isAppTestMode(): boolean {
  const v = process.env.APP_TEST_MODE;
  return v === "1" || v === "true";
}
