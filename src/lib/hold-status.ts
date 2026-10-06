/** Hold statuses that keep a unit off the public list and block a second hold. Mirrors the "Hold_one_active_per_unit" index. */
export const BLOCKING_HOLD_STATUSES = ["active", "confirmed_pay_separately"];

export function blockingHoldWhere(now = new Date()) {
  return { status: { in: BLOCKING_HOLD_STATUSES }, expiresAt: { gt: now } };
}
