import type { Metadata } from "next";
import { BRAND } from "@/config/locations";
import { showDraftNotices } from "@/lib/site-env";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">KV Self Storage website terms</h1>
      {showDraftNotices() && (
        <p className="text-sm text-kv-muted">Draft. To be reviewed by the owner before launch. Your signed rental agreement governs your tenancy.</p>
      )}
      {!showDraftNotices() && <p className="text-sm text-kv-muted">Your signed rental agreement governs your tenancy.</p>}
      <h2>Online holds</h2>
      <p>Starting checkout holds your selected unit for 20 minutes. When the timer ends, the hold is released. Starting a hold does not take a payment or give you access.</p>
      <h2>Prices</h2>
      <p>Monthly rent is shown before HST. Checkout shows the full move-in total, including fees and HST, before you pay. Availability can change. We check your unit again when you start a hold.</p>
      <h2>Promotions</h2>
      <p>Promotions apply only at the locations and dates shown. They may change or end at any time.</p>
      <h2>Refunds</h2>
      <p>
        The owner reviews refund requests. Refunds are not automatic. Call {BRAND.phone} or email {BRAND.email} about your situation.
      </p>
      <h2>Moving out</h2>
      <p>Submit your planned move-out date through My storage. Follow your rental agreement. Empty the unit and remove any personal lock by that date. We process the move-out to close your rental.</p>
      <h2>Unit sizes</h2>
      <p>All unit sizes are approximate.</p>
    </div>
  );
}
