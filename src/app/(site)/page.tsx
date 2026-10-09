import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LocalSchema } from "@/components/LocalSchema";
import { LocationCards } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { ReviewsBlock } from "@/components/Reviews";
import { BRAND } from "@/config/locations";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: { absolute: "Self Storage in Antigonish and Stellarton | KV Self Storage" },
  description: "Compare storage units in Antigonish, Addington Forks and Stellarton. Gated entry, cameras and 24/7 access. See prices and choose your size.",
};

export default async function Home() {
  const [promos, inventory, settings] = await Promise.all([getLivePromotions({ placement: "homepage" }), getInventory(), getSettings()]);
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
          <h1 className="h1 mt-3">Self storage in Antigonish and Stellarton</h1>
          <p className="mt-4 max-w-lg text-lg text-kv-muted">Moving? Downsizing? Out of room? Store the things you still need.</p>
          <p className="mt-3 max-w-lg text-kv-muted">Compare sizes and prices at our three locations. Gated coded entry, cameras and 24/7 access.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/units" className="btn-primary">
              See units &amp; prices
            </Link>
            <Link href="/size-finder" className="btn-ghost">
              Help me choose a size
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <Image src="/photos/hero.jpg" alt="Row of white roll-up storage doors at KV Self Storage" width={929} height={622} priority sizes="(max-width: 1024px) 100vw, 50vw" className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="container-kv pb-16">
        <h2 className="h2">Keep your stuff. Get your space back.</h2>
        <p className="mt-4 max-w-3xl text-kv-muted">You don&apos;t have to get rid of things just because they won&apos;t fit. Choose a unit for what you&apos;re keeping. We&apos;ll help you work out the size.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Moving or downsizing", "Store furniture and boxes while you move. Keep what you want without packing it into a smaller home."],
            ["Studying at StFX", "Store your dorm room belongings between terms. Haley Road is close to StFX."],
            ["Running a business", "Make room for stock, tools and equipment. Choose a unit with space to reach what you use."],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <h3 className="text-lg font-extrabold text-kv-navy">{title}</h3>
              <p className="mt-2 text-sm text-kv-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-kv pb-16">
        <h2 className="h2">Know the size. Know the cost.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Find the right fit", "Use the size finder. Compare your options. Call us if you're between sizes."],
            ["See the full price", "Check the monthly rent. Review fees and HST before you pay. No surprise fees."],
            ["Get in when you need to", "All three locations have 24/7 access, gated coded entry and cameras. Finish your rental and access setup before you move in."],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <h3 className="text-lg font-extrabold text-kv-navy">{title}</h3>
              <p className="mt-2 text-sm text-kv-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-kv-navy-50 py-16">
        <div className="container-kv">
          <h2 className="h2">Choose your location</h2>
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
          <h2 className="h2">Get started in three steps</h2>
          <ol className="mt-6 space-y-5">
            {[
              ["Choose your unit", "Pick your location and size. Check the price."],
              ["Finish your checkout", "Your unit is held for 20 minutes. Review the total and follow the payment or reservation steps."],
              ["Get ready to move in", "Finish your lease and access setup. Your confirmation tells you what to do next."],
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
          <Link href="/units" className="btn-primary mt-8">
            See units &amp; prices
          </Link>
        </div>
      </section>

      {settings.showReviews && <ReviewsBlock />}

      <section className="container-kv">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-kv-red px-6 py-10 text-white sm:px-10">
          <div>
            <h2 className="text-2xl font-extrabold">Need somewhere to put it?</h2>
            <p className="mt-1 text-white/85">
              Check the sizes and prices. If you&apos;re unsure what will fit, call{" "}
              <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-yellow underline">
                {BRAND.phone}
              </a>
              .
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/units" className="btn-yellow">
              See units &amp; prices
            </Link>
            <Link href="/size-finder" className="btn border border-white/50 bg-transparent text-white hover:bg-white/10">
              Help me choose a size
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
