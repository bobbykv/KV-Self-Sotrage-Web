import type { Metadata } from "next";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">Privacy</h1>
      <p className="text-sm text-kv-muted">Draft — to be reviewed by the owner before launch.</p>
      <p>KV Self Storage collects only what we need to rent and manage your storage: your name, contact details, the unit you rent, and your account history.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Reservations and rentals:</strong> name, email, phone and move-in date, stored in our property management system (SiteLink) so we can hold your unit and manage your lease.
        </li>
        <li>
          <strong>Enquiries and waitlist requests:</strong> what you share in our forms or chat, sent to our customer contact system so we can follow up.
        </li>
        <li>
          <strong>Maintenance and unit-change requests:</strong> the details and photos you send, kept so we can resolve the issue.
        </li>
      </ul>
      <h2>Payment cards</h2>
      <p>This website never stores your card number. Card payments are processed by our property management system&apos;s payment provider.</p>
      <h2>Chat assistant</h2>
      <p>Our website chat is an automated assistant. Please don&apos;t share card numbers or passwords in chat. Messages may be processed by an AI service provider to generate replies.</p>
      <h2>Your choices</h2>
      <p>
        You can ask to see or correct your information, or to stop receiving messages, at any time: {BRAND.email} or {BRAND.phone}.
      </p>
    </div>
  );
}
