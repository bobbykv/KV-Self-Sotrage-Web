import Image from "next/image";
import Link from "next/link";
import { LocalSchema } from "@/components/LocalSchema";
import { LocationCards } from "@/components/LocationCards";
import { PromoBanner } from "@/components/PromoBanner";
import { ReviewsBlock } from "@/components/Reviews";
import { BRAND } from "@/config/locations";
import { getLivePromotions } from "@/lib/cms";
import { getInventory } from "@/lib/inventory";
import { env } from "@/lib/env";

export default async function Home() {
  const [promos, inventory] = await Promise.all([getLivePromotions({ placement: "homepage" }), getInventory()]);
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
          <h1 className="h1 mt-3">Make room for what&apos;s next. Keep what matters.</h1>
          <p className="mt-4 max-w-lg text-lg text-kv-muted">
            Moving or settling into a smaller home? You don&apos;t have to part with belongings you&apos;re not ready to let go of. Find clean, secure storage close to home, with help choosing the right size.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/units" className="btn-primary">
              Find your space
            </Link>
            <Link href="/size-finder" className="btn-ghost">
              Help me choose a size
            </Link>
          </div>
          <p className="mt-6 text-sm text-kv-muted">
            Want help deciding? Call{" "}
            <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
              {BRAND.phone}
            </a>
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <Image src="/photos/hero.jpg" alt="Row of white roll-up storage doors at KV Self Storage" width={929} height={622} priority className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="container-kv pb-16">
        <p className="eyebrow">When life needs a little more space</p>
        <h2 className="h2 mt-2">Your next chapter doesn&apos;t have to mean letting go</h2>
        <p className="mt-4 max-w-3xl text-kv-muted">A move, a smaller home, or a growing business can leave you short on room. Give your belongings a place of their own so you can take your next step with less clutter and more peace of mind.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Moving or downsizing", "Keep furniture, keepsakes, and the things you still want while you get settled."],
            ["Room for your business", "Store stock, tools, and equipment so your workspace can work for you."],
            ["Between school terms", "Leave your belongings near campus instead of packing them home for the summer."],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <h3 className="text-lg font-extrabold text-kv-navy">{title}</h3>
              <p className="mt-2 text-sm text-kv-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-kv pb-16">
        <p className="eyebrow">A little guidance goes a long way</p>
        <h2 className="h2 mt-2">Feel good about where your belongings are</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Choose the space you need", "Start with the size guide, compare monthly prices, and ask us if you need a second opinion."],
            ["Store with peace of mind", "Clean units, gated entry, and camera surveillance help you feel confident about where you store."],
            ["Get to your things when you need them", "With 24/7 access, you can collect a box or add a load when it fits your day."],
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
          <p className="eyebrow">Three locations</p>
          <h2 className="h2 mt-2">Keep your belongings within reach</h2>
          <p className="mt-3 max-w-2xl text-kv-muted">Choose a location that fits your day in Antigonish, Addington Forks, or Stellarton. All three offer 24/7 access.</p>
          <div className="mt-8">
            <LocationCards counts={counts} />
          </div>
        </div>
      </section>

      <section className="container-kv grid gap-10 py-16 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="Drive-up storage units with yellow safety bollards" width={940} height={361} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="eyebrow">How it works</p>
          <h2 className="h2 mt-2">From needing room to feeling settled</h2>
          <ol className="mt-6 space-y-5">
            {[
              ["Find your space", "Tell us what you're storing or compare sizes and monthly prices. We'll help if you're unsure."],
              ["Arrange your rental", env.PAYMENT_MODE === "passthrough" ? "Choose your move-in date, review the full total, and pay online. Your confirmation explains your lease and access." : "Choose your move-in date and reserve online. We'll help you finish payment and your rental before you move in."],
              ["Move forward with peace of mind", "Once your rental and access are ready, bring your belongings over. They're nearby whenever you need them."],
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
            <h2 className="text-2xl font-extrabold">Ready for a little more breathing room?</h2>
            <p className="mt-1 text-white/85">Find a space for what matters and take your next step.</p>
          </div>
          <Link href="/units" className="btn-yellow">
            Find your space
          </Link>
        </div>
      </section>
    </>
  );
}
