import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { allowSearchIndexing } from "@/lib/site-env";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

const siteUrl = process.env.APP_URL && !/localhost|127\.0\.0\.1/i.test(process.env.APP_URL) ? process.env.APP_URL : "https://kvselfstorage.ca";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Self Storage in Antigonish and Stellarton | KV Self Storage",
    template: "%s | KV Self Storage",
  },
  description: "Compare storage units in Antigonish, Addington Forks and Stellarton. Gated entry, cameras and 24/7 access. See prices and choose your size.",
  openGraph: {
    siteName: "KV Self Storage",
    locale: "en_CA",
    type: "website",
    images: [{ url: "/photos/hero.jpg", width: 929, height: 622, alt: "KV Self Storage units" }],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  robots: allowSearchIndexing() ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#790909", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={montserrat.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
