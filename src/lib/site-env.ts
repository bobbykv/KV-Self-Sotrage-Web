/**
 * Client- and server-safe site environment helpers.
 * NEXT_PUBLIC_SITE_ENV=production is required before search engines are invited.
 */
export type SiteEnv = "production" | "staging" | "test" | "development";

export function siteEnv(): SiteEnv {
  const v = (process.env.NEXT_PUBLIC_SITE_ENV ?? "").toLowerCase();
  if (v === "production" || v === "prod") return "production";
  if (v === "staging" || v === "preview") return "staging";
  if (v === "test" || process.env.APP_TEST_MODE === "1" || process.env.APP_TEST_MODE === "true") return "test";
  return "development";
}

export function isProductionSite(): boolean {
  return siteEnv() === "production";
}

/** Draft / demo notices must never appear on the public production site. */
export function showDraftNotices(): boolean {
  return !isProductionSite();
}

/** Search engines should only index the production host. */
export function allowSearchIndexing(): boolean {
  return isProductionSite();
}
