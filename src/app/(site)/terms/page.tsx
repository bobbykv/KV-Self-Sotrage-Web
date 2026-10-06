import type { Metadata } from "next";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">Terms of use</h1>
      <p className="text-sm text-kv-muted">Draft — to be reviewed by the owner before launch. Your signed rental agreement governs your tenancy.</p>
      <h2>Online holds</h2>
      <p>Choosing &ldquo;Hold this unit&rdquo; reserves it for a short time (shown on screen) while you check out. If the timer ends, the hold is released and nothing is charged.</p>
      <h2>Prices</h2>
      <p>Prices come from our booking system and refresh regularly. The total shown at checkout — including HST as its own line — is what you pay at move-in.</p>
      <h2>Promotions</h2>
      <p>Promotions apply as described, at the locations and dates shown, and may be changed or ended at any time.</p>
      <h2>Refunds</h2>
      <p>
        Refunds are never automatic. They are reviewed and handled personally by the owner. Contact {BRAND.phone} or {BRAND.email}.
      </p>
      <h2>Move-outs</h2>
      <p>Scheduling a move-out online lets us know your plans. Your tenancy ends when staff process the move-out.</p>
      <h2>Unit sizes</h2>
      <p>All sizes are approximate.</p>
    </div>
  );
}
