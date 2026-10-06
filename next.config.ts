import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "prisma"],
  // The FAQ, shared prompt and tool schema are read from disk at runtime.
  // Prisma's query engine has to be traced in or Vercel throws on the first query.
  outputFileTracingIncludes: {
    "/**": ["./agent-brain/**", "./node_modules/.prisma/client/**", "./node_modules/@prisma/client/**"],
  },
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(admin|portal|checkout)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
