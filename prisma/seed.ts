import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { passwordProblems } from "../src/lib/password-policy";

const db = new PrismaClient();

const DEMO_ADMIN_EMAIL = "owner@kvselfstorage.ca";
const DEMO_ADMIN_PASSWORD = "Kv-Storage-Demo-2026!";

async function main() {
  const appTestMode = process.env.APP_TEST_MODE === "1" || process.env.APP_TEST_MODE === "true";
  if (appTestMode) {
    const email = DEMO_ADMIN_EMAIL;
    if (await db.adminUser.findUnique({ where: { email } })) {
      console.log(`Demo owner ${email} already exists — password left unchanged.`);
    } else {
      await db.adminUser.create({
        data: {
          email,
          name: "Demo Owner",
          role: "owner",
          passwordHash: await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12),
        },
      });
      console.log(`Created APP_TEST_MODE demo owner ${email} / ${DEMO_ADMIN_PASSWORD}`);
    }
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (!appTestMode) console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping owner account.");
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
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
