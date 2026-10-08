import Link from "next/link";
import { BRAND, LOCATIONS, formatOfficeHours, fullAddress } from "@/config/locations";
import { getPublishedPosts } from "@/lib/cms";
import { getSettings } from "@/lib/settings";

export async function Footer() {
  const [settings, posts] = await Promise.all([getSettings(), getPublishedPosts().catch(() => [])]);
  return (
    <footer className="mt-20 bg-kv-navy text-white/85">
      <div className="container-kv grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-white">Storage in Antigonish and Stellarton.</p>
          <p className="mt-2 text-sm">Three locations. Gated coded entry, cameras and 24/7 access. Call us if you need help choosing a unit.</p>
          <a href={`tel:${BRAND.phoneE164}`} className="mt-4 block text-lg font-bold text-kv-yellow">
            {BRAND.phone}
          </a>
          <a href={`mailto:${BRAND.email}`} className="text-sm underline">
            {BRAND.email}
          </a>
        </div>
        {LOCATIONS.map((l) => (
          <div key={l.key} className="text-sm">
            <p className="font-bold text-white">{l.cardTitle}</p>
            <p className="mt-1">{fullAddress(l)}</p>
            <p className="mt-1">Access {l.access}</p>
            <p>Office {formatOfficeHours(l)}</p>
            <Link href={`/locations/${l.key}`} className="mt-2 inline-block font-semibold text-kv-yellow underline">
              Location details
            </Link>
            <Link href={`/units?location=${l.key}`} className="mt-1 block font-semibold text-kv-yellow underline">
              See units &amp; prices
            </Link>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-kv flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} KV Self Storage · All sizes approximate.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/self-storage-antigonish">Antigonish storage</Link>
            <Link href="/self-storage-stellarton">Stellarton storage</Link>
            <Link href="/self-storage-new-glasgow">Storage near New Glasgow</Link>
            {posts.length > 0 && <Link href="/blog">Storage tips</Link>}
            {settings.showReviews && <Link href="/reviews">Reviews</Link>}
            <Link href="/contact">Contact</Link>
            <Link href="/maintenance">Report a problem</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
