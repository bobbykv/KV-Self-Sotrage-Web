import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const FACILITY_PHOTOS = [
  {
    locationKey: "stellarton",
    url: "/photos/facility-stellarton-gate.jpg",
    caption: "Secure gated entrance at KV Self Storage Stellarton",
    altText: "KV Self Storage Stellarton facility entrance with security gate and stone pillars",
    isCover: true,
  },
  {
    locationKey: "hwy4",
    url: "/photos/facility-exit31-exterior.jpg",
    caption: "KV Self Storage at Exit 31 - Highway 4",
    altText: "Exterior view of KV Self Storage facility at Exit 31 with multiple storage units at sunset",
    isCover: true,
  },
];

async function main() {
  console.log("Adding facility location photos...");

  for (const photo of FACILITY_PHOTOS) {
    // Check if photo already exists for this location
    const existing = await db.galleryPhoto.findFirst({
      where: {
        kind: "location",
        locationKey: photo.locationKey,
        url: photo.url,
      },
    });

    if (existing) {
      console.log(`  ✓ ${photo.locationKey} - already exists`);
      continue;
    }

    // Get sort order (number of existing photos of this kind for this location)
    const count = await db.galleryPhoto.count({
      where: {
        kind: "location",
        locationKey: photo.locationKey,
      },
    });

    // If this should be the cover, unset any existing covers
    if (photo.isCover) {
      await db.galleryPhoto.updateMany({
        where: {
          kind: "location",
          locationKey: photo.locationKey,
          isCover: true,
        },
        data: { isCover: false },
      });
    }

    await db.galleryPhoto.create({
      data: {
        kind: "location",
        locationKey: photo.locationKey,
        url: photo.url,
        blobPath: null, // Using static files from public folder
        caption: photo.caption,
        altText: photo.altText,
        sortOrder: count,
        isCover: photo.isCover || count === 0,
      },
    });

    console.log(`  ✓ Added ${photo.locationKey} facility photo`);
  }

  console.log("\nFacility photos seeded successfully!");
}

main()
  .catch((err) => {
    console.error("Error seeding facility photos:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
