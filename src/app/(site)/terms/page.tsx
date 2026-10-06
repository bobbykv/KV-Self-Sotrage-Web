import type { Metadata } from "next";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">Terms of use</h1>
      <p className="text-sm text-kv-muted">Draft. To be reviewed by the owner before launch. Your signed rental agreement governs your tenancy.</p>
      <h2>Online holds</h2>
      <p>Starting checkout holds your selected space for the time shown on screen while you review your rental. If the timer ends, the hold is released. Starting a hold does not take a payment or give you access to the unit.</p>
      <h2>Prices</h2>
      <p>Monthly rent is shown before HST. Review the full move-in total, including fees and HST, at checkout before payment. Availability can change, and your chosen unit is checked again when you start a hold.</p>
      <h2>Promotions</h2>
      <p>Promotions apply as described, at the locations and dates shown, and may be changed or ended at any time.</p>
      <h2>Refunds</h2>
      <p>
        Refund requests are reviewed by the owner and are not automatic. If your plans change, contact {BRAND.phone} or {BRAND.email} so we can review your situation.
      </p>
      <h2>Move-outs</h2>
      <p>Schedule your planned move-out date in your account and follow your rental agreement. Empty your unit and remove any personal lock by that date. Staff process the move-out to close your rental.</p>
      <h2>Unit sizes</h2>
      <p>All sizes are approximate.</p>
    </div>
  );
}
