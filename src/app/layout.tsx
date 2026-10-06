import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

const siteUrl = process.env.APP_URL ?? "https://kvselfstorage.ca";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KV Self Storage | Self Storage in Antigonish & Stellarton, NS",
    template: "%s | KV Self Storage",
  },
  description:
    "Local self storage in Antigonish and Stellarton, Nova Scotia. Live unit prices, 24/7 access, climate-controlled units and RV/boat parking. Hold a unit online in minutes.",
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
