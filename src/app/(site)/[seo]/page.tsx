import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalSchema } from "@/components/LocalSchema";
import { PublishedRateCard, UnitGroupCard } from "@/components/UnitCards";
import { LOCATIONS } from "@/config/locations";
import { SEO_PAGES } from "@/content/seo-pages";
import { groupUnits, publishedRates } from "@/lib/catalog";
import { getPublicDiscountPlans } from "@/lib/discount-catalog";
import { offerForUnit } from "@/lib/sitelink/concessions";
import { getInventory } from "@/lib/inventory";

type Params = { seo: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ seo: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { seo } = await params;
  const page = SEO_PAGES.find((p) => p.slug === seo);
  return page ? { title: { absolute: page.title }, description: page.description, alternates: { canonical: `/${page.slug}` } } : {};
}

export default async function SeoLanding({ params }: { params: Promise<Params> }) {
  const { seo } = await params;
  const page = SEO_PAGES.find((p) => p.slug === seo);
  if (!page) notFound();
  const [inventory, discountPlans] = await Promise.all([getInventory(), getPublicDiscountPlans()]);
  const scoped = inventory.filter((l) => page.locations.includes(l.location));
  const groups = groupUnits(scoped.filter((l) => l.availability === "live" || l.availability === "demo").flatMap((l) => l.units)).slice(0, 6);
  const rates = publishedRates(scoped.filter((l) => l.availability === "published").flatMap((l) => l.priceList)).slice(0, 6);
  const locs = LOCATIONS.filter((l) => page.locations.includes(l.key));
  const primary = page.primaryCta ?? { href: page.locations.length === 1 ? `/units?location=${page.locations[0]}` : "/units", label: "See units & prices" };
  const secondary = page.secondaryCta ?? { href: "tel:+19028673779", label: "Call (902) 867-3779" };

  return (
    <div className="container-kv py-10 sm:py-16">
      <LocalSchema only={page.locations} />
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow">{locs.map((l) => l.shortName).join(" · ")}</p>
          <h1 className="h1 mt-2">{page.h1}</h1>
          <p className="mt-4 text-lg text-kv-muted">{page.intro}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {primary.href.startsWith("tel:") ? (
              <a href={primary.href} className="btn-primary">
                {primary.label}
              </a>
            ) : (
              <Link href={primary.href} className="btn-primary">
                {primary.label}
              </Link>
            )}
            {secondary.href.startsWith("tel:") ? (
              <a href={secondary.href} className="btn-ghost">
                {secondary.label}
              </a>
            ) : (
              <Link href={secondary.href} className="btn-ghost">
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
        <Image src="/photos/hero.jpg" alt="KV Self Storage units" width={929} height={622} className="rounded-3xl" />
      </div>

      <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-extrabold text-kv-navy">{s.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      {(groups.length > 0 || rates.length > 0) && (
        <section className="mt-14">
          <h2 className="h2">
            {page.slug === "self-storage-near-me"
              ? "Compare units near you"
              : page.slug === "self-storage-new-glasgow"
                ? "Compare units near New Glasgow"
                : page.slug === "self-storage-stellarton"
                  ? "Compare Stellarton units"
                  : "Compare Antigonish units"}
          </h2>
          {rates.length > 0 && groups.length === 0 && (
            <p className="mt-2 text-sm text-kv-muted">Published prices are below. Call to confirm availability before you plan a move-in.</p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <UnitGroupCard key={g.key} g={g} offer={offerForUnit(discountPlans[g.locationKey] ?? [], g)} />
            ))}
            {groups.length === 0 && rates.map((g) => <PublishedRateCard key={g.key} g={g} offer={offerForUnit(discountPlans[g.locationKey] ?? [], g)} />)}
          </div>
        </section>
      )}

      <p className="mt-12 text-sm text-kv-muted">Serving {page.nearby.join(", ")}.</p>
    </div>
  );
}
