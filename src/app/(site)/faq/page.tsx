import type { Metadata } from "next";
import { BRAND } from "@/config/locations";
import { getFaq } from "@/lib/faq";
import { renderMarkdown } from "@/lib/markdown";
import { showDraftNotices } from "@/lib/site-env";

export const metadata: Metadata = {
  title: "Self Storage Questions in Antigonish and Stellarton",
  description: "Get answers about storage sizes, prices, reservations, office hours and access at KV Self Storage in Antigonish and Stellarton.",
};

export default async function FaqPage() {
  const cats = await getFaq();
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cats.flatMap((c) => c.entries).map((e) => ({ "@type": "Question", name: e.question, acceptedAnswer: { "@type": "Answer", text: e.answer.replace(/\*\*/g, "") } })),
  };
  return (
    <div className="container-kv max-w-3xl py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      {showDraftNotices() && <p className="text-sm text-kv-muted">Draft. FAQ answers are still being reviewed before launch.</p>}
      <h1 className="h1">Self storage questions for Antigonish and Stellarton</h1>
      <p className="mt-3 text-kv-muted">
        Here&apos;s what to know before you book. Need help with your own situation? Call{" "}
        <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
          {BRAND.phone}
        </a>
        .
      </p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="FAQ categories">
        {cats.map((c) => (
          <a key={c.name} href={`#cat-${c.entries[0]?.id}`} className="badge border border-kv-line px-3 py-1.5 text-kv-navy hover:border-kv-navy">
            {c.name}
          </a>
        ))}
      </nav>
      {cats.map((c) => (
        <section key={c.name} id={`cat-${c.entries[0]?.id}`} className="mt-10">
          <h2 className="text-xl font-extrabold text-kv-navy">{c.name}</h2>
          <div className="mt-3 divide-y divide-kv-line rounded-2xl border border-kv-line">
            {c.entries.map((e) => (
              <details key={e.id} id={e.id} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-kv-navy [&::-webkit-details-marker]:hidden">
                  {e.question}
                  <span className="text-kv-red transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="prose-kv mt-2 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.answer) }} />
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
