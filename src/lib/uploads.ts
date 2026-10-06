import "server-only";
import { db } from "./db";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Small images stored in Postgres (blog covers, maintenance). Gallery photos use blob-upload.ts. */
export async function saveImage(
  file: File,
  purpose: "blog_cover" | "maintenance_photo" | "gallery_photo",
  isPublic: boolean,
): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!ALLOWED.has(file.type)) throw new Error("Photos must be JPG, PNG, WebP or HEIC.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Each photo must be under 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const row = await db.upload.create({ data: { mime: file.type, size: file.size, bytes, isPublic, purpose } });
  return row.id;
}
