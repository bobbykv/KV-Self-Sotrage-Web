import type { Metadata } from "next";
import Image from "next/image";
import { SizeFinder } from "./SizeFinder";

export const metadata: Metadata = {
  title: "Storage Size Finder",
  description: "Get a starting size estimate for your belongings, then compare storage spaces and monthly prices at KV Self Storage.",
};

export default function SizeFinderPage() {
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Size finder</p>
        <h1 className="h1 mt-2">Find enough room for what matters</h1>
        <p className="mt-3 text-kv-muted">You shouldn&apos;t have to guess how much space to rent. Tell us what you&apos;re storing for a starting estimate, then compare sizes and prices.</p>
        <div className="mt-6 overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="KV Self Storage drive-up units" width={940} height={361} className="w-full object-cover" />
        </div>
        <ul className="mt-6 space-y-2 text-sm text-kv-muted">
          <li>
            <strong className="text-kv-navy">5′×5′</strong>: about a closet for boxes, bins, or a bike
          </li>
          <li>
            <strong className="text-kv-navy">5′×10′</strong>: about a walk-in closet for a dorm room or small furniture
          </li>
          <li>
            <strong className="text-kv-navy">10′×10′</strong>: about half a garage for a one-bedroom apartment
          </li>
          <li>
            <strong className="text-kv-navy">10′×20′</strong>: about a one-car garage for a two- to three-bedroom home
          </li>
        </ul>
      </div>
      <div className="lg:pt-16">
        <SizeFinder />
      </div>
    </div>
  );
}
