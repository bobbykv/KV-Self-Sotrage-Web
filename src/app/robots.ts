import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://kvselfstorage.ca";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/checkout", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
