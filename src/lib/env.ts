import "server-only";
import { z } from "zod";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { isAppTestMode } from "./test-mode";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TEST_MODE: z.string().optional(),

  SITELINK_MODE: z.enum(["live", "mock"]).optional(),
  SITELINK_ENDPOINT: z.string().url().default("https://api.smdservers.net/CCWs_3.5/CallCenterWs.asmx"),
  SITELINK_REPORTING_ENDPOINT: z.string().url().default("https://api.smdservers.net/CCWs_3.5/ReportingWs.asmx"),
  SITELINK_CORP_CODE: z.string().optional(),
  SITELINK_LOCATION_CODES: z.string().optional(),
  SITELINK_API_USERNAME: z.string().optional(),
  SITELINK_API_PASSWORD: z.string().optional(),
  SITELINK_TEST_MODE: z.string().optional(),
  SITELINK_TIMEOUT_MS: z.coerce.number().default(20000),

  PAYMENT_MODE: z.enum(["pay_separately", "passthrough"]).default("pay_separately"),
  PAY_ONLINE_URL: z.string().url().optional(),
  HST_RATE: z.coerce.number().default(0.14),

  GHL_WEBHOOK_URL: z.string().url().optional(),
  GHL_API_KEY: z.string().optional(),
  GHL_LOCATION_ID: z.string().optional(),

  CHAT_LLM_API_KEY: z.string().optional(),
  CHAT_LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  CHAT_LLM_MODEL: z.string().default("gpt-4o-mini"),

  NOTIFY_WEBHOOK_URL: z.string().url().optional(),
  OWNER_NOTIFY_EMAIL: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  AGENT_TOOL_SECRET: z.string().min(16).optional(),
  /** Retell API key with the webhook badge — verifies X-Retell-Signature on /api/retell/webhook. */
  RETELL_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
}
const raw = parsed.data;
const appTestMode = isAppTestMode();

function parseLocationCodes(value: string | undefined): Partial<Record<LocationKey, string>> {
  if (!value) return {};
  const out: Partial<Record<LocationKey, string>> = {};
  for (const pair of value.split(",")) {
    const [key, code] = pair.split(":").map((s) => s.trim());
    if (key && code && (LOCATION_KEYS as readonly string[]).includes(key)) out[key as LocationKey] = code;
  }
  return out;
}

const hasLiveCreds = Boolean(
  raw.SITELINK_CORP_CODE && raw.SITELINK_API_USERNAME && raw.SITELINK_API_PASSWORD && raw.SITELINK_LOCATION_CODES,
);

const sitelinkMode = (appTestMode ? "mock" : raw.SITELINK_MODE ?? (hasLiveCreds ? "live" : "mock")) as "live" | "mock";
/** Simulator (mock SiteLink or APP_TEST_MODE) always uses the fake card form. */
const paymentMode = (appTestMode || sitelinkMode === "mock" ? "passthrough" : raw.PAYMENT_MODE) as "pay_separately" | "passthrough";

/**
 * APP_TEST_MODE forces the isolated simulator even when live credentials are
 * present in the host environment (e.g. a Vercel project that also has go-live
 * secrets configured). Integration secrets are ignored at runtime.
 */
export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  appTestMode,
  sitelinkMode,
  sitelinkLocationCodes: appTestMode ? ({} as Partial<Record<LocationKey, string>>) : parseLocationCodes(raw.SITELINK_LOCATION_CODES),
  sitelinkTestMode: appTestMode || raw.SITELINK_TEST_MODE === "1" || raw.SITELINK_TEST_MODE === "true",
  PAYMENT_MODE: paymentMode,
  PAY_ONLINE_URL: appTestMode || sitelinkMode === "mock" ? undefined : raw.PAY_ONLINE_URL,
  GHL_WEBHOOK_URL: appTestMode ? undefined : raw.GHL_WEBHOOK_URL,
  GHL_API_KEY: appTestMode ? undefined : raw.GHL_API_KEY,
  GHL_LOCATION_ID: appTestMode ? undefined : raw.GHL_LOCATION_ID,
  CHAT_LLM_API_KEY: appTestMode ? undefined : raw.CHAT_LLM_API_KEY,
  NOTIFY_WEBHOOK_URL: appTestMode ? undefined : raw.NOTIFY_WEBHOOK_URL,
  OWNER_NOTIFY_EMAIL: appTestMode ? undefined : raw.OWNER_NOTIFY_EMAIL,
  RETELL_API_KEY: appTestMode ? undefined : raw.RETELL_API_KEY,
};

/** Called lazily (not at import) so `next build` works without production secrets. */
export function assertSiteLinkConfig() {
  if (env.appTestMode) return;
  if (env.sitelinkMode === "live" && !hasLiveCreds) {
    throw new Error(
      "SITELINK_MODE=live requires SITELINK_CORP_CODE, SITELINK_LOCATION_CODES, SITELINK_API_USERNAME, SITELINK_API_PASSWORD",
    );
  }
  if (
    env.isProd &&
    env.sitelinkMode === "mock" &&
    process.env.ALLOW_MOCK_IN_PRODUCTION !== "1" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "Refusing to serve production traffic with mock SiteLink data. Set SiteLink credentials, APP_TEST_MODE=1 for the hosted simulator, or ALLOW_MOCK_IN_PRODUCTION=1 for a staging demo.",
    );
  }
}

/** Cookie names — separate in test mode so a production browser session cannot collide. */
export const cookieNames = {
  admin: env.appTestMode ? "kv_test_admin" : "kv_admin",
  tenant: env.appTestMode ? "kv_test_tenant" : "kv_tenant",
  hold: env.appTestMode ? "kv_test_hold" : "kv_hold",
};
