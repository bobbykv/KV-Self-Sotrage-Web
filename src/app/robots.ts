import type { MetadataRoute } from "next";
import { allowSearchIndexing } from "@/lib/site-env";

export default function robots(): MetadataRoute.Robots {
  if (!allowSearchIndexing()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/portal", "/checkout", "/api", "/testing"],
    },
    sitemap: "https://kvselfstorage.ca/sitemap.xml",
  };
}
