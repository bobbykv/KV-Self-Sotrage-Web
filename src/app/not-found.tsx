import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PhoneIcon } from "@/components/Header";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container-kv max-w-2xl py-16 text-center sm:py-24">
        <p className="eyebrow">404</p>
        <h1 className="h2 mt-2">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-kv-muted">
          The link may be out of date, or the page may have moved. Compare our units and locations, or call us and we&apos;ll help.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={`tel:${BRAND.phoneE164}`} className="btn-primary">
            <PhoneIcon />
            Call {BRAND.phone}
          </a>
          <Link href="/units" className="btn-navy">
            See units &amp; prices
          </Link>
          <Link href="/locations" className="btn-ghost">
            Our locations
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
