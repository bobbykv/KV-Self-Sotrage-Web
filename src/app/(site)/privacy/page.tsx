import type { Metadata } from "next";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">Privacy</h1>
      <p className="text-sm text-kv-muted">Draft. To be reviewed by the owner before launch.</p>
      <p>When you enquire, reserve, or rent, you share information that helps us arrange your storage and support you during your rental.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Reservations and rentals:</strong> your name, email, phone, and move-in date help us hold your selected space, contact you, and manage your rental. Rental information is stored in SiteLink, our rental management provider.
        </li>
        <li>
          <strong>Enquiries and waitlist requests:</strong> the contact details and storage needs you share help us answer your questions or let you know when a suitable space opens.
        </li>
        <li>
          <strong>Maintenance and unit-change requests:</strong> your request details and any photos help us understand the problem or the space you need.
        </li>
      </ul>
      <h2>Payment cards</h2>
      <p>This website never stores your card number. Card payments are processed by our property management system&apos;s payment provider.</p>
      <h2>Chat assistant</h2>
      <p>The website assistant is automated. Please keep card numbers, passwords, and access codes out of chat. Messages may be processed by an AI service provider to generate replies.</p>
      <h2>Your choices</h2>
      <p>
        You can ask to see or correct your information, or to stop receiving messages, at any time: {BRAND.email} or {BRAND.phone}.
      </p>
    </div>
  );
}
