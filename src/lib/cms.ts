import "server-only";
import { cache } from "react";
import type { LocationKey } from "@/config/locations";
import { db } from "./db";
import { log, safeErrorMessage } from "./log";
import { isPromoLive, promoMatches, type Placement } from "./promotions";

export async function getLivePromotions(opts: { placement?: Placement; location?: LocationKey | null } = {}) {
  const now = new Date();
  let rows;
  try {
    rows = await db.promotion.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  } catch (err) {
    log.error("promotions read failed", { err: safeErrorMessage(err) });
    return [];
  }
  return rows.filter((p) => isPromoLive(p, now) && promoMatches(p, opts));
}

export const getPublishedPosts = cache(async () => {
  try {
    return await db.blogPost.findMany({
      where: { published: true, publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
    });
  } catch (err) {
    log.error("blog read failed", { err: safeErrorMessage(err) });
    return [];
  }
});

/** Existence check for footer/nav — avoids loading full post rows. */
export const hasPublishedPosts = cache(async (): Promise<boolean> => {
  try {
    const post = await db.blogPost.findFirst({
      where: { published: true, publishedAt: { lte: new Date() } },
      select: { id: true },
    });
    return Boolean(post);
  } catch (err) {
    log.error("blog existence check failed", { err: safeErrorMessage(err) });
    return false;
  }
});

export async function getPublishedPost(slug: string) {
  try {
    const post = await db.blogPost.findUnique({ where: { slug } });
    if (!post || !post.published || !post.publishedAt || post.publishedAt > new Date()) return null;
    return post;
  } catch (err) {
    log.error("blog read failed", { err: safeErrorMessage(err) });
    return null;
  }
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
