"use server";

import { redirect } from "next/navigation";
import { isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { endSession, requireTenant, tenantLogin } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/log";
import { tenantOwnsLedger } from "@/lib/portal";
import { rateLimit } from "@/lib/rate-limit";
import { createMaintenanceRequest, createTransferRequest, maintenanceSchema, transferSchema } from "@/lib/requests";
import { sitelink } from "@/lib/sitelink/client";
import { saveImage } from "@/lib/uploads";

export type FormState = { ok?: boolean; error?: string; message?: string };

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const res = await tenantLogin(email, password);
  if (!res.ok) return { error: res.error };
  redirect("/portal");
}

export async function logoutAction() {
  await endSession("tenant");
  redirect("/portal/login");
}

/** Tenants with several units pick one radio "loc|unitName"; split it back into the form fields. */
function applyUnitChoice(form: FormData) {
  const choice = form.get("unitChoice");
  if (typeof choice !== "string" || !choice.includes("|")) return;
  const [loc, unit] = choice.split("|");
  form.set("locationKey", loc);
  form.set(String(form.get("_unitField") ?? "unitName"), unit);
  form.delete("unitChoice");
  form.delete("_unitField");
}

function linkFor(session: Awaited<ReturnType<typeof requireTenant>>, loc: string) {
  return isLocationKey(loc) ? session.links.find((l) => l.locationKey === loc) : undefined;
}

export async function scheduleMoveOutAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireTenant();
  const link = linkFor(session, String(form.get("locationKey")));
  const ledgerId = Number(form.get("ledgerId"));
  const date = String(form.get("date") ?? "");
  if (!link || !ledgerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a move-out date." };
  const when = new Date(`${date}T12:00:00`);
  if (when.getTime() < Date.now() - 86_400_000) return { error: "Choose a date from today onward." };
  const ledger = await tenantOwnsLedger(link, ledgerId);
  if (!ledger) return { error: "We couldn't find that unit on your account." };
  try {
    await sitelink.scheduleMoveOut(link.locationKey, ledgerId, when);
    await audit(`tenant:${link.tenantId}`, "portal.schedule_move_out", `${link.locationKey}:${ledger.unitName}`, { date });
    return {
      ok: true,
      message: `Your move-out has been requested for ${date}. We still need to process it to close your rental. Any outstanding balance remains due.`,
    };
  } catch {
    return { error: `We couldn't send your move-out date. Try again or call (902) 867-3779.` };
  }
}

export async function cancelMoveOutAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireTenant();
  const link = linkFor(session, String(form.get("locationKey")));
  const ledgerId = Number(form.get("ledgerId"));
  if (!link || !ledgerId) return { error: "Choose a unit." };
  const ledger = await tenantOwnsLedger(link, ledgerId);
  if (!ledger) return { error: "We couldn't find that unit on your account." };
  try {
    await sitelink.scheduleMoveOut(link.locationKey, ledgerId, null);
    await audit(`tenant:${link.tenantId}`, "portal.cancel_move_out", `${link.locationKey}:${ledger.unitName}`);
    return { ok: true, message: "Your move-out request has been cancelled." };
  } catch {
    return { error: `We couldn't cancel the move-out request. Call (902) 867-3779.` };
  }
}

export async function maintenanceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireTenant();
  applyUnitChoice(form);
  const link = linkFor(session, String(form.get("locationKey")));
  if (!link) return { error: "Choose your location." };
  if (!(await rateLimit(`maint:${link.tenantId}`, 10, 3600))) return { error: "We've received several requests from you. For an urgent problem, please call us." };
  const parsed = maintenanceSchema.safeParse({ ...Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")), email: form.get("email") ?? session.email });
  if (!parsed.success) return { error: "Please choose the unit and issue type, and describe the problem." };
  try {
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    const photoIds = (await Promise.all(photos.map((p) => saveImage(p, "maintenance_photo", false)))).filter(Boolean) as string[];
    const row = await createMaintenanceRequest(parsed.data, { tenantId: link.tenantId, verified: true, photoIds });
    const ref = row.id.slice(0, 8).toUpperCase();
    return { ok: true, message: `Your report has been sent. Reference number: ${ref}.` };
  } catch (err) {
    return { error: safeErrorMessage(err, 120) || "We couldn't send your report. Try again or call (902) 867-3779." };
  }
}

export async function transferAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireTenant();
  applyUnitChoice(form);
  const link = linkFor(session, String(form.get("locationKey")));
  if (!link) return { error: "Choose your current location." };
  if (!(await rateLimit(`transfer:${link.tenantId}`, 5, 3600))) return { error: "We've received several requests from you. Please call if you need help sooner." };
  const timing = String(form.get("timing") ?? "");
  const specificDate = String(form.get("specificDate") ?? "").trim();
  if (timing === "specific_date" && !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
    return { error: "Choose the date you need the new unit." };
  }
  const reasonParts = [String(form.get("reason") ?? "").trim(), timing === "specific_date" ? `Needed by ${specificDate}` : ""].filter(Boolean);
  form.set("reason", reasonParts.join(" · "));
  const parsed = transferSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please tell us your current unit, what you'd like, and when." };
  const info = await sitelink.tenantInfo(link.locationKey, link.tenantId).catch(() => null);
  await createTransferRequest(parsed.data, {
    tenantId: link.tenantId,
    name: info ? `${info.tenant.firstName} ${info.tenant.lastName}`.trim() : session.email,
    email: info?.tenant.email || session.email,
    phone: info?.tenant.phone,
  });
  return { ok: true, message: "Your request has been sent. We'll contact you about the options." };
}
