"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { HOLD_COOKIE } from "@/lib/holds";
import { safeErrorMessage } from "@/lib/log";
import { isLocationKey } from "@/config/locations";
import { sitelink } from "@/lib/sitelink/client";

export async function setPortalPassword(holdId: string, _prev: { ok?: boolean; error?: string }, form: FormData) {
  if ((await cookies()).get(HOLD_COOKIE)?.value !== holdId) return { error: "Please use the device you checked out on." };
  const pw = String(form.get("password") ?? "");
  if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) return { error: "Use at least 8 characters with letters and a number." };
  const hold = await db.hold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== "moved_in" || !hold.tenantCreated || hold.portalPasswordSet || !hold.tenantId || !isLocationKey(hold.locationKey)) {
    return { error: "Portal setup isn't available for this booking. Call the office and we'll set it up." };
  }
  try {
    await sitelink.setPortalPassword(hold.locationKey, hold.tenantId, hold.email, pw);
    await db.hold.update({ where: { id: holdId }, data: { portalPasswordSet: true } });
    return { ok: true };
  } catch (err) {
    return { error: `We couldn't save that password (${safeErrorMessage(err, 80)}). Call the office and we'll set it up.` };
  }
}
