import { PrismaClient } from "@prisma/client";
import { LOCATION_KEYS } from "../src/config/locations";

const db = new PrismaClient();

const UNIT_PHOTOS = [
  {
    widthFt: 5,
    lengthFt: 10,
    url: "/photos/unit-5x10.jpg",
    caption: "5x10 storage unit interior",
    altText: "Clean 5x10 storage unit with metal roll-up door",
  },
  {
    widthFt: 10,
    lengthFt: 15,
    url: "/photos/unit-10x15.jpg",
    caption: "10x15 storage unit interior",
    altText: "Spacious 10x15 storage unit with climate control",
  },
  {
    widthFt: 10,
    lengthFt: 20,
    url: "/photos/unit-10x20.jpg",
    caption: "10x20 storage unit interior",
    altText: "Large 10x20 storage unit perfect for household goods",
  },
];

async function main() {
  console.log("Adding unit type photos...");

  for (const location of LOCATION_KEYS) {
    for (const photo of UNIT_PHOTOS) {
      const sizeKey = `${photo.widthFt}x${photo.lengthFt}`;
      
      // Check if photo already exists for this location and size
      const existing = await db.galleryPhoto.findFirst({
        where: {
          kind: "unit_type",
          locationKey: location,
          widthFt: photo.widthFt,
          lengthFt: photo.lengthFt,
        },
      });

      if (existing) {
        console.log(`  ✓ ${location} ${sizeKey} - already exists`);
        continue;
      }

      // Get sort order (number of existing photos of this kind for this location)
      const count = await db.galleryPhoto.count({
        where: {
          kind: "unit_type",
          locationKey: location,
        },
      });

      await db.galleryPhoto.create({
        data: {
          kind: "unit_type",
          locationKey: location,
          widthFt: photo.widthFt,
          lengthFt: photo.lengthFt,
          climate: null,
          url: photo.url,
          blobPath: null, // Using static files from public folder
          caption: photo.caption,
          altText: photo.altText,
          sortOrder: count,
          isCover: false,
        },
      });

      console.log(`  ✓ Added ${location} ${sizeKey}`);
    }
  }

  console.log("\nUnit photos seeded successfully!");
}

main()
  .catch((err) => {
    console.error("Error seeding unit photos:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
