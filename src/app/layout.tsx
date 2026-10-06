import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

const siteUrl = process.env.APP_URL ?? "https://kvselfstorage.ca";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Self Storage in Antigonish and Stellarton | KV Self Storage",
    template: "%s | KV Self Storage",
  },
  description: "Compare storage units in Antigonish, Addington Forks and Stellarton. Gated entry, cameras and 24/7 access. See prices and choose your size.",
  openGraph: { siteName: "KV Self Storage", locale: "en_CA", type: "website" },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = { themeColor: "#790909", width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={montserrat.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
