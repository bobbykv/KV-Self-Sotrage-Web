import type { MetadataRoute } from "next";
import { SEO_PAGES } from "@/content/seo-pages";
import { getPublishedPosts } from "@/lib/cms";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "https://kvselfstorage.ca";
  const staticPaths = ["", "/units", "/locations", "/size-finder", "/faq", "/blog", "/reviews", "/contact", "/maintenance", "/privacy", "/terms"];
  const posts = await getPublishedPosts().catch(() => []);
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "/units" ? ("hourly" as const) : ("weekly" as const) })),
    ...SEO_PAGES.map((p) => ({ url: `${base}/${p.slug}`, changeFrequency: "monthly" as const })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
