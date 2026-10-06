import type { Metadata } from "next";
import Image from "next/image";
import { SizeFinder } from "./SizeFinder";

export const metadata: Metadata = {
  title: "Storage Size Finder",
  description: "Answer three quick questions and we'll suggest the right storage unit size at KV Self Storage.",
};

export default function SizeFinderPage() {
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Size finder</p>
        <h1 className="h1 mt-2">What size do I need?</h1>
        <p className="mt-3 text-kv-muted">Three quick questions. We&apos;ll point you to units that are open right now.</p>
        <div className="mt-6 overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="KV Self Storage drive-up units" width={940} height={361} className="w-full object-cover" />
        </div>
        <ul className="mt-6 space-y-2 text-sm text-kv-muted">
          <li>
            <strong className="text-kv-navy">5′×5′</strong> — about a closet: boxes, bins, a bike
          </li>
          <li>
            <strong className="text-kv-navy">5′×10′</strong> — a walk-in closet: a dorm room or studio
          </li>
          <li>
            <strong className="text-kv-navy">10′×10′</strong> — half a garage: a 1-bedroom apartment
          </li>
          <li>
            <strong className="text-kv-navy">10′×20′</strong> — a one-car garage: a 2–3 bedroom home
          </li>
        </ul>
      </div>
      <div className="lg:pt-16">
        <SizeFinder />
      </div>
    </div>
  );
}
