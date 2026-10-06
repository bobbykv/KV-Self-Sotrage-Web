import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";
import { BRAND, LOCATIONS, formatHours, fullAddress } from "@/config/locations";

export const metadata: Metadata = {
  title: "Help Choosing Your Storage",
  description: "Call (902) 867-3779 or email info@kvselfstorage.ca. Office hours and addresses for all three KV Self Storage locations.",
};

export default function ContactPage() {
  return (
    <div className="container-kv grid gap-10 py-10 sm:py-16 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="h1 mt-2">A little help choosing your next step</h1>
        <p className="mt-3 text-kv-muted">Unsure how much space you need or what it will cost? Tell us what you&apos;re storing and we&apos;ll help you work through the options. Call during office hours, or leave a message.</p>
        <a href={`tel:${BRAND.phoneE164}`} className="btn-primary mt-6 text-lg">
          {BRAND.phone}
        </a>
        <p className="mt-3">
          <a href={`mailto:${BRAND.email}`} className="font-semibold text-kv-navy underline">
            {BRAND.email}
          </a>
        </p>
        <div className="mt-10 space-y-6">
          {LOCATIONS.map((l) => (
            <div key={l.key}>
              <p className="font-extrabold text-kv-navy">{l.name}</p>
              <p className="text-sm">{fullAddress(l)}</p>
              <p className="text-sm text-kv-muted">
                Office {l.officeHours.map((h) => `${h.days} ${formatHours(h)}`).join(", ")} · Access {l.access}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="card self-start p-6">
        <h2 className="text-xl font-extrabold text-kv-navy">Tell us what you need</h2>
        <p className="mt-1 mb-4 text-sm text-kv-muted">Whether you&apos;re planning a move, making room at home, or storing for your business, you don&apos;t have to figure it out alone.</p>
        <LeadForm reason="contact_request" submitLabel="Ask for help" />
      </div>
    </div>
  );
}
