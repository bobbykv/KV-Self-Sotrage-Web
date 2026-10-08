import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { passwordProblems } from "../src/lib/password-policy";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping owner account.");
  } else if (await db.adminUser.findUnique({ where: { email } })) {
    console.log(`Owner ${email} already exists — password left unchanged.`);
  } else {
    const problems = passwordProblems(password, email);
    if (problems.length) throw new Error(`ADMIN_PASSWORD needs: ${problems.join("; ")}`);
    await db.adminUser.create({ data: { email, name: process.env.ADMIN_NAME ?? "Owner", role: "owner", passwordHash: await bcrypt.hash(password, 12) } });
    console.log(`Created owner account ${email}.`);
  }

  if (process.env.SEED_SAMPLE_CONTENT === "1" && (await db.blogPost.count()) === 0) {
    await db.blogPost.create({
      data: {
        title: "How to pick the right storage unit size",
        slug: "how-to-pick-a-storage-unit-size",
        excerpt: "A quick guide to choosing between small, medium and large units so you don't pay for space you won't use.",
        body: "## Start with what you're storing\n\nAs a starting estimate, compare 5x5 to 5x10 for boxes or dorm-room belongings, 5x10 to 10x10 for a studio or one-bedroom apartment, and 10x15 to 10x20 for a two- to three-bedroom home. Furniture dimensions, the number of boxes, and room to reach your things all affect the fit.\n\n## Not sure?\n\nTry our [size finder](/size-finder) or call (902) 867-3779 and we'll help.",
        published: false,
      },
    });
    console.log("Added a sample draft blog post.");
  }

  // Seed unit type photos
  const unitPhotos = [
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

  const locations = ["haley", "hwy4", "stellarton"];
  let photoCount = 0;

  for (const location of locations) {
    for (const photo of unitPhotos) {
      const existing = await db.galleryPhoto.findFirst({
        where: {
          kind: "unit_type",
          locationKey: location,
          widthFt: photo.widthFt,
          lengthFt: photo.lengthFt,
        },
      });

      if (!existing) {
        const count = await db.galleryPhoto.count({
          where: { kind: "unit_type", locationKey: location },
        });

        await db.galleryPhoto.create({
          data: {
            kind: "unit_type",
            locationKey: location,
            widthFt: photo.widthFt,
            lengthFt: photo.lengthFt,
            url: photo.url,
            caption: photo.caption,
            altText: photo.altText,
            sortOrder: count,
            isCover: false,
          },
        });
        photoCount++;
      }
    }
  }

  if (photoCount > 0) {
    console.log(`Added ${photoCount} unit type photo(s).`);
  }

  // Seed facility location photos
  const facilityPhotos = [
    {
      locationKey: "haley",
      url: "/photos/facility-haley-office.jpg",
      caption: "KV Self Storage Haley Road office and facility",
      altText: "KV Self Storage Haley Road location with office building and storage units",
      isCover: true,
    },
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

  let facilityPhotoCount = 0;

  for (const photo of facilityPhotos) {
    const existing = await db.galleryPhoto.findFirst({
      where: {
        kind: "location",
        locationKey: photo.locationKey,
        url: photo.url,
      },
    });

    if (!existing) {
      const count = await db.galleryPhoto.count({
        where: { kind: "location", locationKey: photo.locationKey },
      });

      if (photo.isCover) {
        await db.galleryPhoto.updateMany({
          where: { kind: "location", locationKey: photo.locationKey, isCover: true },
          data: { isCover: false },
        });
      }

      await db.galleryPhoto.create({
        data: {
          kind: "location",
          locationKey: photo.locationKey,
          url: photo.url,
          caption: photo.caption,
          altText: photo.altText,
          sortOrder: count,
          isCover: photo.isCover || count === 0,
        },
      });
      facilityPhotoCount++;
    }
  }

  if (facilityPhotoCount > 0) {
    console.log(`Added ${facilityPhotoCount} facility photo(s).`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
