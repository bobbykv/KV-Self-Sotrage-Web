import type { Metadata } from "next";
import Image from "next/image";
import { ReviewsBlock } from "@/components/Reviews";

export const metadata: Metadata = {
  title: "Storage Reviews & Peace of Mind",
  description: "Choose storage with confidence. Explore customer reviews and get help with size, pricing, and access in Antigonish and Pictou County.",
};

const TRUST = [
  ["Help choosing the right fit", "Talk through what you're storing so you can choose enough room without guessing."],
  ["Know the cost before you commit", "Compare monthly prices and review your full move-in total, including HST, before payment."],
  ["A clean place for your belongings", "Give furniture, boxes, and keepsakes a place of their own while you make room at home."],
  ["Store with peace of mind", "Gated entry and camera surveillance help you feel confident about where your belongings are."],
  ["Access around your day", "With 24/7 access, you can get to your belongings when it suits you."],
  ["Help when your plans change", "Need a different size or ready to move out? Send a request through your account or contact us."],
];

export default function ReviewsPage() {
  return (
    <>
      <div className="container-kv py-10 sm:py-16">
        <p className="eyebrow">Trust</p>
        <h1 className="h1 mt-2">Feel confident about your next step</h1>
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
