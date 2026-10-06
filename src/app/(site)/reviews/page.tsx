import type { Metadata } from "next";
import Image from "next/image";
import { ReviewsBlock } from "@/components/Reviews";

export const metadata: Metadata = {
  title: "Reviews & why locals trust us",
  description: "Why people in Antigonish and Pictou County store with KV Self Storage: local ownership, honest prices, 24/7 access and real people on the phone.",
};

const TRUST = [
  ["Locally owned", "We live here too. When you call, you get someone who knows the sites."],
  ["Real prices online", "What you see on the website comes straight from our booking system — no \"call for price\" games."],
  ["No surprise fees", "Every charge, including HST, is on its own line before you pay."],
  ["Secure sites", "Gated, coded entry and camera surveillance at every location, with 24/7 access."],
  ["Refunds handled by a person", "If something changes, the owner looks at it personally."],
  ["Fewer phone calls", "Report maintenance, request a unit change or schedule a move-out from the portal."],
];

export default function ReviewsPage() {
  return (
    <>
      <div className="container-kv py-10 sm:py-16">
        <p className="eyebrow">Trust</p>
        <h1 className="h1 mt-2">Why people store with KV</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.map(([t, d]) => (
            <div key={t} className="card p-6">
              <p className="font-extrabold text-kv-navy">{t}</p>
              <p className="mt-1 text-sm text-kv-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Image src="/photos/hero.jpg" alt="Row of storage units" width={929} height={622} className="rounded-3xl" />
          <Image src="/photos/facility-2.jpg" alt="Drive-up storage doors with safety bollards" width={940} height={361} className="h-full rounded-3xl object-cover" />
        </div>
      </div>
      <ReviewsBlock />
    </>
  );
}
