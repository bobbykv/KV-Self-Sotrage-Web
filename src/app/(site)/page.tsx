import Image from "next/image";
import Link from "next/link";
import { LocalSchema } from "@/components/LocalSchema";
import { LocationCards } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { ReviewsBlock } from "@/components/Reviews";
import { BRAND } from "@/config/locations";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";

export default async function Home() {
  const [promos, inventory] = await Promise.all([getLivePromotions({ placement: "homepage" }), getInventory()]);
  const availabilityDown = inventory.every((l) => l.units.length === 0 && l.lastError && !l.refreshedAt);
  const counts = Object.fromEntries(inventory.map((l) => [l.location, l.units.length]));

  return (
    <>
      <LocalSchema />
      <section className="container-kv pt-6 sm:pt-10">
        <PromoBanner promos={promos} />
      </section>

      <section className="container-kv grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Antigonish · Addington Forks · Stellarton</p>
          <h1 className="h1 mt-3">Local storage, honest prices, open 24/7.</h1>
          <p className="mt-4 max-w-lg text-lg text-kv-muted">
            See real prices and what&apos;s open right now. Hold a unit online for 20 minutes while you check out — no surprise fees, HST shown up front.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/units" className="btn-primary">
              Find a unit
            </Link>
            <Link href="/size-finder" className="btn-ghost">
              Not sure what size?
            </Link>
          </div>
          <p className="mt-6 text-sm text-kv-muted">
            Rather talk to someone?{" "}
            <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
              {BRAND.phone}
            </a>
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <Image src="/photos/hero.jpg" alt="Row of white roll-up storage doors at KV Self Storage" width={929} height={622} priority className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="bg-kv-navy-50 py-16">
        <div className="container-kv">
          <p className="eyebrow">Three locations</p>
          <h2 className="h2 mt-2">Pick the one closest to you</h2>
          <div className="mt-8">
            <LocationCards counts={availabilityDown ? undefined : counts} />
          </div>
          {availabilityDown && (
            <p className="mt-4 text-sm text-kv-muted">
              Live availability isn&apos;t connected yet. Call{" "}
              <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
                {BRAND.phone}
              </a>{" "}
              and we&apos;ll tell you what&apos;s open.
            </p>
          )}
        </div>
      </section>

      <section className="container-kv grid gap-10 py-16 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="Drive-up storage units with yellow safety bollards" width={940} height={361} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="eyebrow">How it works</p>
          <h2 className="h2 mt-2">Rent in a few minutes, from your phone</h2>
          <ol className="mt-6 space-y-5">
            {[
              ["Pick your unit", "Live sizes and prices from our booking system, updated about every 30 minutes."],
              ["We hold it for 20 minutes", "The unit is set aside for you while you check out. If time runs out, it just goes back on the list."],
              ["See every line before you pay", "Rent, any admin fee or deposit, and HST — each on its own line. No end-of-checkout surprises."],
              ["Move in", "We'll confirm your access details. Need help? We're local and we answer the phone."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kv-yellow font-extrabold text-kv-navy">{i + 1}</span>
                <div>
                  <p className="font-bold text-kv-navy">{t}</p>
                  <p className="text-sm text-kv-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ReviewsBlock />

      <section className="container-kv">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-kv-red px-6 py-10 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <h2 className="text-2xl font-extrabold">Questions before you book?</h2>
            <p className="mt-1 text-white/85">Hours, access, Noke smart locks, student storage — it&apos;s all in the FAQ.</p>
          </div>
          <Link href="/faq" className="btn-yellow">
            Read the FAQ
          </Link>
        </div>
      </section>
    </>
  );
}
