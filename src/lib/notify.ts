import "server-only";
import { env } from "./env";
import { log } from "./log";
import { redact } from "./redact";

export type StaffEvent =
  | "maintenance_request"
  | "transfer_request"
  | "hold_confirmed_pay_separately"
  | "move_in_completed"
  | "payment_failed"
  | "lead_ghl_failed";

/**
 * Owner/staff notifications. Every event is also visible in /admin, so this
 * is best-effort: it posts JSON to NOTIFY_WEBHOOK_URL (a GHL workflow
 * webhook, Slack, Zapier, etc. — destination is an open owner decision).
 */
export async function notifyStaff(event: StaffEvent, summary: string, details: Record<string, unknown> = {}) {
  const payload = {
    event,
    summary,
    adminUrl: `${env.APP_URL}/admin`,
    notifyEmail: env.OWNER_NOTIFY_EMAIL,
    details: redact(details),
    at: new Date().toISOString(),
  };
  if (!env.NOTIFY_WEBHOOK_URL) {
    log.info("staff notification (no NOTIFY_WEBHOOK_URL set)", { event, summary });
    return;
  }
  try {
    const res = await fetch(env.NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) log.warn("staff notification non-2xx", { event, status: res.status });
  } catch (err) {
    log.warn("staff notification failed", { event, err });
  }
}
