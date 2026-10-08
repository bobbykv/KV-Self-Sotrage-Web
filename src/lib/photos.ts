import "server-only";
import type { LocationKey } from "@/config/locations";
import { db } from "./db";
import { log, safeErrorMessage } from "./log";
import { deleteBlobIfAny, uploadGalleryImage, type GalleryKind } from "./blob-upload";

export type PhotoRecord = {
  id: string;
  kind: GalleryKind;
  locationKey: string;
  unitTypeName: string | null;
  widthFt: number | null;
  lengthFt: number | null;
  climate: boolean | null;
  url: string;
  caption: string | null;
  altText: string;
  sortOrder: number;
  isCover: boolean;
};

const STOCK = {
  hero: "/photos/hero.jpg",
  facility: "/photos/facility-2.jpg",
};

export function stockPhotoForUnit(opts: { inside?: boolean; vehicle?: boolean }) {
  return opts.inside || opts.vehicle ? STOCK.facility : STOCK.hero;
}

/** Static unit photos shipped in /public/photos — no database required. */
const STATIC_UNIT_PHOTOS: { widthFt: number; lengthFt: number; url: string }[] = [
  { widthFt: 5, lengthFt: 10, url: "/photos/unit-5x10.jpg" },
  { widthFt: 10, lengthFt: 15, url: "/photos/unit-10x15.jpg" },
  { widthFt: 10, lengthFt: 20, url: "/photos/unit-10x20.jpg" },
];

/** Fast path for the public units list: bundled photos first, then stock art. */
export function listingUnitPhotoUrl(g: { widthFt: number; lengthFt: number; inside?: boolean; vehicle?: boolean }): string {
  const match = STATIC_UNIT_PHOTOS.find((p) => p.widthFt === g.widthFt && p.lengthFt === g.lengthFt);
  if (match) return match.url;
  return stockPhotoForUnit({ inside: g.inside, vehicle: g.vehicle });
}

export async function listLocationPhotos(locationKey: LocationKey): Promise<PhotoRecord[]> {
  try {
    const rows = await db.galleryPhoto.findMany({
      where: { kind: "location", locationKey },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapRow);
  } catch (err) {
    log.warn("listLocationPhotos failed", { locationKey, err: safeErrorMessage(err) });
    return [];
  }
}

export async function locationCoverUrl(locationKey: LocationKey): Promise<string> {
  try {
    const cover = await db.galleryPhoto.findFirst({
      where: { kind: "location", locationKey, isCover: true },
      orderBy: { sortOrder: "asc" },
    });
    if (cover) return cover.url;
    const any = await db.galleryPhoto.findFirst({ where: { kind: "location", locationKey }, orderBy: { sortOrder: "asc" } });
    return any?.url ?? STOCK.hero;
  } catch (err) {
    log.warn("locationCoverUrl failed", { locationKey, err: safeErrorMessage(err) });
    return STOCK.hero;
  }
}

export async function unitTypePhotoUrl(opts: {
  locationKey: LocationKey;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  climate?: boolean;
  inside?: boolean;
  vehicle?: boolean;
}): Promise<string> {
  try {
    const exact = await db.galleryPhoto.findFirst({
      where: {
        kind: "unit_type",
        locationKey: opts.locationKey,
        OR: [
          { widthFt: opts.widthFt, lengthFt: opts.lengthFt },
          { unitTypeName: opts.typeName },
        ],
      },
      orderBy: [{ sortOrder: "asc" }],
    });
    if (exact) return exact.url;
    const cover = await locationCoverUrl(opts.locationKey);
    if (cover !== STOCK.hero) return cover;
  } catch (err) {
    log.warn("unitTypePhotoUrl failed", { locationKey: opts.locationKey, err: safeErrorMessage(err) });
  }
  return stockPhotoForUnit({ inside: opts.inside, vehicle: opts.vehicle });
}

function mapRow(r: {
  id: string;
  kind: string;
  locationKey: string;
  unitTypeName: string | null;
  widthFt: number | null;
  lengthFt: number | null;
  climate: boolean | null;
  url: string;
  caption: string | null;
  altText: string;
  sortOrder: number;
  isCover: boolean;
}): PhotoRecord {
  return {
    id: r.id,
    kind: r.kind as GalleryKind,
    locationKey: r.locationKey,
    unitTypeName: r.unitTypeName,
    widthFt: r.widthFt,
    lengthFt: r.lengthFt,
    climate: r.climate,
    url: r.url,
    caption: r.caption,
    altText: r.altText,
    sortOrder: r.sortOrder,
    isCover: r.isCover,
  };
}

export async function addGalleryPhoto(input: {
  kind: GalleryKind;
  locationKey: LocationKey;
  file: File;
  caption?: string;
  altText?: string;
  unitTypeName?: string;
  widthFt?: number;
  lengthFt?: number;
  climate?: boolean;
  isCover?: boolean;
}) {
  const uploaded = await uploadGalleryImage(input.file);
  const count = await db.galleryPhoto.count({ where: { kind: input.kind, locationKey: input.locationKey } });
  if (input.isCover || count === 0) {
    await db.galleryPhoto.updateMany({ where: { kind: "location", locationKey: input.locationKey }, data: { isCover: false } });
  }
  return db.galleryPhoto.create({
    data: {
      kind: input.kind,
      locationKey: input.locationKey,
      unitTypeName: input.unitTypeName ?? null,
      widthFt: input.widthFt ?? null,
      lengthFt: input.lengthFt ?? null,
      climate: input.climate ?? null,
      url: uploaded.url,
      blobPath: uploaded.blobPath,
      caption: input.caption?.trim() || null,
      altText: input.altText?.trim() || input.caption?.trim() || `${input.locationKey} storage photo`,
      sortOrder: count,
      isCover: input.kind === "location" ? Boolean(input.isCover || count === 0) : false,
      widthPx: uploaded.widthPx || null,
      heightPx: uploaded.heightPx || null,
    },
  });
}

export async function updateGalleryPhoto(
  id: string,
  patch: { caption?: string; altText?: string; isCover?: boolean; sortOrder?: number; unitTypeName?: string | null; widthFt?: number | null; lengthFt?: number | null },
) {
  const existing = await db.galleryPhoto.findUniqueOrThrow({ where: { id } });
  if (patch.isCover && existing.kind === "location") {
    await db.galleryPhoto.updateMany({ where: { kind: "location", locationKey: existing.locationKey }, data: { isCover: false } });
  }
  return db.galleryPhoto.update({
    where: { id },
    data: {
      caption: patch.caption !== undefined ? patch.caption.trim() || null : undefined,
      altText: patch.altText !== undefined ? patch.altText.trim() : undefined,
      isCover: patch.isCover,
      sortOrder: patch.sortOrder,
      unitTypeName: patch.unitTypeName === undefined ? undefined : patch.unitTypeName,
      widthFt: patch.widthFt === undefined ? undefined : patch.widthFt,
      lengthFt: patch.lengthFt === undefined ? undefined : patch.lengthFt,
    },
  });
}

export async function reorderGalleryPhotos(ids: string[]) {
  await Promise.all(ids.map((id, i) => db.galleryPhoto.update({ where: { id }, data: { sortOrder: i } })));
}

export async function deleteGalleryPhoto(id: string) {
  const row = await db.galleryPhoto.findUnique({ where: { id } });
  if (!row) return;
  await deleteBlobIfAny(row.blobPath, row.url);
  await db.galleryPhoto.delete({ where: { id } });
  if (row.isCover) {
    const next = await db.galleryPhoto.findFirst({ where: { kind: "location", locationKey: row.locationKey }, orderBy: { sortOrder: "asc" } });
    if (next) await db.galleryPhoto.update({ where: { id: next.id }, data: { isCover: true } });
  }
}
