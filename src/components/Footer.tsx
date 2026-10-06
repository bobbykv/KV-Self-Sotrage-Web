import Link from "next/link";
import { BRAND, LOCATIONS, formatHours, fullAddress } from "@/config/locations";

export function Footer() {
  return (
    <footer className="mt-20 bg-kv-navy text-white/85">
      <div className="container-kv grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-white">KV Self Storage</p>
          <p className="mt-2 text-sm">Space for what matters, close to home in Antigonish and Pictou County.</p>
          <a href={`tel:${BRAND.phoneE164}`} className="mt-4 block text-lg font-bold text-kv-yellow">
            {BRAND.phone}
          </a>
          <a href={`mailto:${BRAND.email}`} className="text-sm underline">
            {BRAND.email}
          </a>
        </div>
        {LOCATIONS.map((l) => (
          <div key={l.key} className="text-sm">
            <p className="font-bold text-white">{l.shortName}</p>
            <p className="mt-1">{fullAddress(l)}</p>
            <p className="mt-1">Access {l.access}</p>
            {l.officeHours.map((h) => (
              <p key={h.days}>
                Office {h.days} {formatHours(h)}
              </p>
            ))}
            <Link href={`/units?location=${l.key}`} className="mt-2 inline-block font-semibold text-kv-yellow underline">
              Find your space
            </Link>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-kv flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} KV Self Storage · All sizes approximate.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/self-storage-antigonish">Antigonish</Link>
            <Link href="/self-storage-new-glasgow">New Glasgow</Link>
            <Link href="/self-storage-stellarton">Stellarton</Link>
            <Link href="/blog">Storage tips</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/maintenance">Report an issue</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
