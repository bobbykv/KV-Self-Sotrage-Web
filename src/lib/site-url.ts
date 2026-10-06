import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/**
 * Public site origin for redirects and absolute links.
 * Prefers the incoming Host / X-Forwarded-* headers so Vercel deploys never
 * bounce users to localhost when APP_URL is mis-set.
 */
export async function publicSiteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host && !/^localhost(:\d+)?$/i.test(host) && !/^127\.0\.0\.1(:\d+)?$/i.test(host)) {
      const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    /* headers() unavailable outside a request */
  }
  const configured = env.APP_URL?.replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return configured || "https://kvselfstorage.ca";
}

/** Absolute URL on the public site, never relative against a localhost APP_URL. */
export async function publicUrl(path: string): Promise<string> {
  const origin = await publicSiteOrigin();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (/localhost|127\.0\.0\.1/i.test(u.hostname)) {
        return `${origin}${u.pathname}${u.search}${u.hash}`;
      }
      return path;
    } catch {
      return path;
    }
  }
  return new URL(path.startsWith("/") ? path : `/${path}`, `${origin}/`).toString();
}
