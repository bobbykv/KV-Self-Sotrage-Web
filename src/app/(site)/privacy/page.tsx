import type { Metadata } from "next";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="container-kv prose-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">KV Self Storage privacy</h1>
      <p className="text-sm text-kv-muted">Draft. To be reviewed by the owner before launch.</p>
      <p>When you ask a question, reserve or rent, we use the details you give us to arrange your storage and help with your rental.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Reservations and rentals:</strong> Your name, email, phone number and move-in date help us hold your unit, contact you and manage your rental. Rental information is stored in SiteLink, our rental management provider.
        </li>
        <li>
          <strong>Enquiries and waitlist requests:</strong> We use your contact details and storage needs to answer questions or tell you when a matching space opens.
        </li>
        <li>
          <strong>Maintenance and unit-change requests:</strong> We use your request details and any photos to check the problem or the change you need.
        </li>
      </ul>
      <h2>Payment cards</h2>
      <p>This website does not store your card number. Card payments are processed by our rental management system&apos;s payment provider.</p>
      <h2>Website assistant</h2>
      <p>The website assistant is automated. Don&apos;t share card numbers, passwords or access codes in chat. An AI service provider may process messages to generate replies.</p>
      <h2>Your choices</h2>
      <p>
        You can ask to see or correct your information, or to stop receiving messages. Email {BRAND.email} or call {BRAND.phone}.
      </p>
    </div>
  );
}
