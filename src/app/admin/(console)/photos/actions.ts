"use server";

import { revalidatePath } from "next/cache";
import { isLocationKey } from "@/config/locations";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { safeErrorMessage } from "@/lib/log";
import { addGalleryPhoto, deleteGalleryPhoto, reorderGalleryPhotos, updateGalleryPhoto } from "@/lib/photos";
import { db } from "@/lib/db";

export type PhotoFormState = { ok?: boolean; error?: string; message?: string };

export async function uploadGalleryAction(_prev: PhotoFormState, form: FormData): Promise<PhotoFormState> {
  const admin = await requireAdmin();
  const kind = String(form.get("kind") ?? "") === "unit_type" ? "unit_type" : "location";
  const locationKey = String(form.get("locationKey") ?? "");
  if (!isLocationKey(locationKey)) return { error: "Choose a location." };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one photo." };
  const caption = String(form.get("caption") ?? "").trim() || undefined;
  const altText = String(form.get("altText") ?? "").trim() || undefined;
  const isCover = form.get("isCover") === "on";
  const unitTypeName = String(form.get("unitTypeName") ?? "").trim() || undefined;
  const widthFt = form.get("widthFt") ? Number(form.get("widthFt")) : undefined;
  const lengthFt = form.get("lengthFt") ? Number(form.get("lengthFt")) : undefined;
  try {
    for (let i = 0; i < files.length; i++) {
      await addGalleryPhoto({
        kind,
        locationKey,
        file: files[i],
        caption,
        altText,
        unitTypeName: kind === "unit_type" ? unitTypeName : undefined,
        widthFt: kind === "unit_type" && Number.isFinite(widthFt) ? widthFt : undefined,
        lengthFt: kind === "unit_type" && Number.isFinite(lengthFt) ? lengthFt : undefined,
        isCover: kind === "location" && isCover && i === 0,
      });
    }
    await audit(admin.email, "gallery.upload", locationKey, { kind, count: files.length });
    revalidatePath("/admin/photos");
    revalidatePath(`/locations/${locationKey}`);
    return { ok: true, message: `Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}.` };
  } catch (err) {
    return { error: safeErrorMessage(err, 160) || "Upload failed." };
  }
}

export async function updatePhotoAction(_prev: PhotoFormState, form: FormData): Promise<PhotoFormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Missing photo." };
  try {
    const widthRaw = form.get("widthFt");
    const lengthRaw = form.get("lengthFt");
    await updateGalleryPhoto(id, {
      caption: form.has("caption") ? String(form.get("caption") ?? "") : undefined,
      altText: form.has("altText") ? String(form.get("altText") ?? "") : undefined,
      isCover: form.get("isCover") === "1" || form.get("isCover") === "on" ? true : undefined,
      unitTypeName: form.has("unitTypeName") ? String(form.get("unitTypeName") ?? "") || null : undefined,
      widthFt: widthRaw !== null && widthRaw !== undefined && String(widthRaw) !== "" ? Number(widthRaw) : form.has("widthFt") ? null : undefined,
      lengthFt: lengthRaw !== null && lengthRaw !== undefined && String(lengthRaw) !== "" ? Number(lengthRaw) : form.has("lengthFt") ? null : undefined,
    });
    const loc = form.get("locationKey");
    if (typeof loc === "string" && isLocationKey(loc)) {
      await db.galleryPhoto.update({ where: { id }, data: { locationKey: loc } });
    }
    revalidatePath("/admin/photos");
    return { ok: true, message: "Photo updated." };
  } catch (err) {
    return { error: safeErrorMessage(err, 120) || "Could not update photo." };
  }
}

export async function setCoverAction(id: string) {
  await requireAdmin();
  await updateGalleryPhoto(id, { isCover: true });
  revalidatePath("/admin/photos");
}

export async function deletePhotoAction(id: string) {
  await requireAdmin();
  await deleteGalleryPhoto(id);
  revalidatePath("/admin/photos");
}

export async function movePhotoAction(id: string, direction: "up" | "down") {
  await requireAdmin();
  const row = await db.galleryPhoto.findUnique({ where: { id } });
  if (!row) return;
  const siblings = await db.galleryPhoto.findMany({
    where: { kind: row.kind, locationKey: row.locationKey },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const i = siblings.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  const ids = siblings.map((s) => s.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await reorderGalleryPhotos(ids);
  revalidatePath("/admin/photos");
}
