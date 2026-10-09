import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/config/locations";

const NAV = [
  { href: "/units", label: "Units & prices" },
  { href: "/locations", label: "Locations" },
  { href: "/size-finder", label: "Size finder" },
  { href: "/faq", label: "FAQ" },
  { href: "/portal", label: "My storage" },
];

export function PhoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-kv-line bg-white/95 backdrop-blur">
      <div className="container-kv flex h-16 items-center justify-between gap-3 sm:h-20">
        <Link href="/" className="flex shrink-0 items-center" aria-label="KV Self Storage home">
          <Image src="/photos/logo-original.jpg" alt="KV Self Storage" width={200} height={88} sizes="160px" className="h-11 w-auto sm:h-14" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-semibold text-kv-navy lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-kv-red">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href={`tel:${BRAND.phoneE164}`} className="btn-primary btn-sm min-h-11 px-4 text-sm sm:text-base" aria-label={`Call ${BRAND.phone}`}>
            <PhoneIcon />
            <span className="hidden sm:inline">Call </span>
            <span>{BRAND.phone}</span>
          </a>
          <details className="relative lg:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-kv-line text-kv-navy [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 mt-2 w-60 rounded-2xl border border-kv-line bg-white p-2 shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-xl px-4 py-3 font-semibold text-kv-navy hover:bg-kv-navy-50">
                  {n.label}
                </Link>
              ))}
              <Link href="/contact" className="block rounded-xl px-4 py-3 font-semibold text-kv-navy hover:bg-kv-navy-50">
                Contact
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
