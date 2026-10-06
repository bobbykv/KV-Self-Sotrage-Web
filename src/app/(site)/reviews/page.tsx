import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ReviewsBlock } from "@/components/Reviews";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "KV Self Storage Reviews | Antigonish and Stellarton",
  description: "Find customer reviews for KV Self Storage on Google.",
};

export default async function ReviewsPage() {
  const settings = await getSettings();
  if (!settings.showReviews) notFound();
  return (
    <>
      <div className="container-kv py-10 sm:py-16">
        <h1 className="h1">KV Self Storage reviews: Antigonish and Stellarton</h1>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Image src="/photos/hero.jpg" alt="Row of storage units" width={929} height={622} className="rounded-3xl" />
          <Image src="/photos/facility-2.jpg" alt="Drive-up storage doors with safety bollards" width={940} height={361} className="h-full rounded-3xl object-cover" />
        </div>
      </div>
      <ReviewsBlock />
    </>
  );
}
