"use server";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/log";
import { createMaintenanceRequest, maintenanceSchema, verifyUnitTenant } from "@/lib/requests";
import { saveImage } from "@/lib/uploads";

export async function publicMaintenanceAction(_prev: { ok?: boolean; error?: string; message?: string }, form: FormData) {
  if (form.get("website")) return { ok: true, message: "Thanks." };
  if (!(await rateLimit(`maint-public:${await clientIp()}`, 5, 3600))) return { error: "Too many requests. Please call (902) 867-3779." };
  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = maintenanceSchema.safeParse(fields);
  if (!parsed.success) return { error: "Please fill in your location, unit, name, issue and a short description." };
  if (!parsed.data.phone && !parsed.data.email) return { error: "Add a phone number or email so we can follow up." };
  try {
    const tenantId = await verifyUnitTenant(parsed.data.locationKey, parsed.data.unitName, parsed.data.name);
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    const photoIds = (await Promise.all(photos.map((p) => saveImage(p, "maintenance_photo", false)))).filter(Boolean) as string[];
    await createMaintenanceRequest(parsed.data, { tenantId, verified: Boolean(tenantId), photoIds });
    return { ok: true, message: "Your report has been sent." };
  } catch (err) {
    return { error: safeErrorMessage(err, 120) || "We couldn't send your report. Try again or call (902) 867-3779." };
  }
}
