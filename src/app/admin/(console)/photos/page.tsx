import { PageHeader } from "@/components/admin/LocationSwitcher";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Photos" };

export default async function AdminPhotosPage() {
  await requireAdmin();
  const rows = await db.galleryPhoto.findMany({
    orderBy: [{ kind: "asc" }, { locationKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const map = (r: (typeof rows)[number]) => ({
    id: r.id,
    kind: r.kind as "location" | "unit_type",
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
  });
  const locationPhotos = rows.filter((r) => r.kind === "location").map(map);
  const unitTypePhotos = rows.filter((r) => r.kind === "unit_type").map(map);

  return (
    <>
      <PageHeader title="Photos" />
      <p className="mb-6 max-w-2xl text-sm text-kv-muted">
        Upload facility and unit-type photos. Location covers appear on location pages; unit-type photos are matched by size on the units list and unit detail pages.
      </p>
      <GalleryManager locationPhotos={locationPhotos} unitTypePhotos={unitTypePhotos} />
    </>
  );
}
