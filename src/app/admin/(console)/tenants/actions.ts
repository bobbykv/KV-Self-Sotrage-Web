"use server";

import { redirect } from "next/navigation";
import { isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/log";
import { sitelink, SiteLinkError } from "@/lib/sitelink/client";

function back(location: string, tenantId: number, notice: string): never {
  redirect(`/admin/tenants/${location}/${tenantId}?notice=${encodeURIComponent(notice)}`);
}

export async function scheduleMoveOutAction(formData: FormData) {
  const admin = await requireAdmin();
  const location = String(formData.get("location") ?? "");
  const tenantId = Number(formData.get("tenantId"));
  const ledgerId = Number(formData.get("ledgerId"));
  const dateRaw = String(formData.get("date") ?? "");
  if (!isLocationKey(location) || !tenantId || !ledgerId) back(location || "haley", tenantId || 0, "That ledger could not be updated.");
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : null;
  if (date && Number.isNaN(date.getTime())) back(location, tenantId, "Choose a move-out date.");
  try {
    await sitelink.scheduleMoveOut(location, ledgerId, date);
  } catch (err) {
    const message = err instanceof SiteLinkError ? safeErrorMessage(err.message) : "SiteLink did not save that move-out date.";
    back(location, tenantId, message);
  }
  await audit(admin.email, date ? "tenant.schedule_move_out" : "tenant.clear_move_out", `${location}:${tenantId}`, { ledgerId, date: dateRaw || null });
  back(location, tenantId, date ? `Move-out scheduled for ${dateRaw}.` : "Scheduled move-out cleared.");
}

export async function immediateMoveOutAction(formData: FormData) {
  const admin = await requireAdmin();
  const location = String(formData.get("location") ?? "");
  const tenantId = Number(formData.get("tenantId"));
  const unitId = Number(formData.get("unitId"));
  const confirm = String(formData.get("confirm") ?? "");
  if (!isLocationKey(location) || !tenantId || !unitId) back(location || "haley", tenantId || 0, "That unit could not be moved out.");
  if (confirm !== "MOVE OUT") back(location, tenantId, "Type MOVE OUT to move this tenant out immediately.");
  try {
    const result = await sitelink.moveOut(location, tenantId, unitId);
    await audit(admin.email, "tenant.move_out", `${location}:${tenantId}`, { unitId, refund: result.refund, balance: result.balance });
    const refund = result.refund ? ` Refund ${result.refund.toFixed(2)}.` : "";
    back(location, tenantId, `Moved out.${refund}`);
  } catch (err) {
    const message = err instanceof SiteLinkError ? err.message.replace(/^MoveOut failed \(Ret_Code -?\d+\): /, "") : "SiteLink did not complete the move-out.";
    back(location, tenantId, message);
  }
}
