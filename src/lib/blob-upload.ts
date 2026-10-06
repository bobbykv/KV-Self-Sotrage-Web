import "server-only";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { db } from "./db";
import { log } from "./log";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
export const MAX_GALLERY_BYTES = 12 * 1024 * 1024;

export type GalleryKind = "location" | "unit_type";

async function compressImage(file: File): Promise<{ buffer: Buffer; mime: string; width: number; height: number }> {
  const input = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  pipeline = sharp(input, { failOn: "none" }).rotate().resize({
    width: 2000,
    height: 2000,
    fit: "inside",
    withoutEnlargement: true,
  });
  const buffer = await pipeline.webp({ quality: 78 }).toBuffer();
  const out = await sharp(buffer).metadata();
  return {
    buffer,
    mime: "image/webp",
    width: out.width ?? meta.width ?? 0,
    height: out.height ?? meta.height ?? 0,
  };
}

/** Upload a compressed gallery image to Vercel Blob (falls back to Postgres Upload when Blob token is unset). */
export async function uploadGalleryImage(file: File): Promise<{ url: string; blobPath: string | null; widthPx: number; heightPx: number; mime: string; size: number }> {
  if (!file || typeof file === "string" || file.size === 0) throw new Error("Choose a photo to upload.");
  if (!ALLOWED.has(file.type) && !file.type.startsWith("image/")) throw new Error("Photos must be JPG, PNG, WebP or HEIC.");
  if (file.size > MAX_GALLERY_BYTES) throw new Error("Each photo must be under 12 MB before compression.");
  const { buffer, mime, width, height } = await compressImage(file);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`, buffer, {
      access: "public",
      contentType: mime,
      token,
    });
    return { url: blob.url, blobPath: blob.pathname, widthPx: width, heightPx: height, mime, size: buffer.length };
  }
  // Local / no-blob fallback: store in Upload table and serve via /api/uploads/:id
  const row = await db.upload.create({
    data: { mime, size: buffer.length, bytes: buffer, isPublic: true, purpose: "gallery_photo" },
  });
  log.info("gallery photo stored in Postgres (no BLOB_READ_WRITE_TOKEN)", { id: row.id });
  return { url: `/api/uploads/${row.id}`, blobPath: null, widthPx: width, heightPx: height, mime, size: buffer.length };
}

export async function deleteBlobIfAny(blobPath: string | null | undefined, url: string) {
  if (!blobPath || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    log.warn("blob delete failed", { err, blobPath });
  }
}
