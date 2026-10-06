import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";
import { BRAND, LOCATIONS, formatOfficeHours, fullAddress } from "@/config/locations";

export const metadata: Metadata = {
  title: "Contact KV Self Storage | Antigonish and Stellarton",
  description: "Call (902) 867-3779 or email info@kvselfstorage.ca for help with storage sizes, prices, rentals and access.",
};

export default function ContactPage() {
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <h1 className="h1">Contact KV Self Storage in Antigonish and Stellarton</h1>
        <p className="mt-3 text-kv-muted">Need help choosing a size? Have a question about your rental? Call or email us.</p>

        <h2 className="mt-8 text-lg font-extrabold text-kv-navy">Call us</h2>
        <a href={`tel:${BRAND.phoneE164}`} className="mt-2 block text-2xl font-extrabold text-kv-red">
          {BRAND.phone}
        </a>
        <p className="mt-1 text-sm text-kv-muted">Outside office hours, leave a message.</p>

        <h2 className="mt-8 text-lg font-extrabold text-kv-navy">Email us</h2>
        <a href={`mailto:${BRAND.email}`} className="mt-2 font-semibold text-kv-navy underline">
          {BRAND.email}
        </a>

        <h2 className="mt-8 text-lg font-extrabold text-kv-navy">Office hours</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {LOCATIONS.map((l) => (
            <li key={l.key}>
              <span className="font-semibold text-kv-navy">{fullAddress(l)}</span>: {formatOfficeHours(l)}.
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-kv-muted">Storage access is 24/7 at all three locations once your rental and access setup are complete.</p>
      </div>
      <div className="card self-start p-6">
        <h2 className="text-xl font-extrabold text-kv-navy">Send us a message</h2>
        <div className="mt-4">
          <LeadForm reason="contact_request" submitLabel="Send message" notesPlaceholder="Tell us what you're storing or what you need help with." />
        </div>
      </div>
    </div>
  );
}
