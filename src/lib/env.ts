import "server-only";
import { z } from "zod";
import { LOCATION_KEYS, type LocationKey } from "@/config/locations";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),

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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
}
const raw = parsed.data;

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

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === "production",
  sitelinkMode: raw.SITELINK_MODE ?? (hasLiveCreds ? "live" : "mock"),
  sitelinkLocationCodes: parseLocationCodes(raw.SITELINK_LOCATION_CODES),
  sitelinkTestMode: raw.SITELINK_TEST_MODE === "1" || raw.SITELINK_TEST_MODE === "true",
};

/** Called lazily (not at import) so `next build` works without production secrets. */
export function assertSiteLinkConfig() {
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
      "Refusing to serve production traffic with mock SiteLink data. Set SiteLink credentials, or ALLOW_MOCK_IN_PRODUCTION=1 for a staging demo.",
    );
  }
}
