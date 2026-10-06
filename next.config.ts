import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://*.public.blob.vercel-storage.com https://api.smdservers.net https://services.leadconnectorhq.com https://api.openai.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "frame-src https://www.google.com https://maps.google.com",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/**": ["./agent-brain/**"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(admin|portal|checkout)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
