import "server-only";
import type { LocationKey } from "@/config/locations";
import { db } from "./db";
import { isPromoLive, promoMatches, type Placement } from "./promotions";

export async function getLivePromotions(opts: { placement?: Placement; location?: LocationKey | null } = {}) {
  const now = new Date();
  const rows = await db.promotion.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.filter((p) => isPromoLive(p, now) && promoMatches(p, opts));
}

export async function getPublishedPosts() {
  return db.blogPost.findMany({
    where: { published: true, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getPublishedPost(slug: string) {
  const post = await db.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published || !post.publishedAt || post.publishedAt > new Date()) return null;
  return post;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
