import type { Metadata } from "next";
import Image from "next/image";
import { SizeFinder } from "./SizeFinder";

export const metadata: Metadata = {
  title: "Storage Size Finder for Antigonish and Stellarton",
  description: "Find a starting size for boxes, furniture, business stock or a household move. Compare available units in Antigonish and Stellarton.",
};

export default function SizeFinderPage() {
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <h1 className="h1">Find your storage size in Antigonish or Stellarton</h1>
        <p className="mt-3 text-kv-muted">Tell us what you&apos;re storing. We&apos;ll suggest sizes to compare. You can check the prices before you choose.</p>
        <div className="mt-6 overflow-hidden rounded-3xl">
          <Image src="/photos/facility-2.jpg" alt="KV Self Storage drive-up units" width={940} height={361} className="w-full object-cover" />
        </div>
        <h2 className="mt-8 text-lg font-extrabold text-kv-navy">A quick size guide</h2>
        <ul className="mt-4 space-y-2 text-sm text-kv-muted">
          <li>
            <strong className="text-kv-navy">5 × 5</strong>: Boxes, seasonal gear or smaller dorm room belongings.
          </li>
          <li>
            <strong className="text-kv-navy">5 × 10</strong>: Boxes and furniture from a smaller apartment.
          </li>
          <li>
            <strong className="text-kv-navy">10 × 10</strong>: Furniture and boxes from a studio or one-bedroom apartment.
          </li>
          <li>
            <strong className="text-kv-navy">10 × 15 to 10 × 20</strong>: A starting range for a two- or three-bedroom move.
          </li>
          <li>
            <strong className="text-kv-navy">10 × 20 to 10 × 30</strong>: A starting range for a larger household.
          </li>
        </ul>
        <p className="mt-4 text-sm text-kv-muted">These are estimates. Measure large items and leave room to reach what you&apos;ll need.</p>
      </div>
      <div className="lg:pt-8">
        <SizeFinder />
      </div>
    </div>
  );
}
