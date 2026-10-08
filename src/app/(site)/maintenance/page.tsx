import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { BRAND, LOCATIONS } from "@/config/locations";
import { ISSUE_TYPES } from "@/lib/requests";
import { publicMaintenanceAction } from "./actions";

export const metadata: Metadata = {
  title: "Report a problem",
  description: "Tell us what's wrong at your Antigonish or Stellarton unit. Add photos if you can.",
};

export default function MaintenancePage() {
  return (
    <div className="container-kv max-w-2xl py-10 sm:py-16">
      <h1 className="h2 mt-2">Report a problem at KV Self Storage</h1>
      <p className="mt-2 text-kv-muted">
        Tell us what&apos;s wrong at your Antigonish or Stellarton unit. Add photos if you can. For an urgent problem, also call{" "}
        <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
          {BRAND.phone}
        </a>
        . You can also send a report through{" "}
        <Link href="/portal#maintenance" className="font-semibold underline">
          My storage
        </Link>
        .
      </p>
      <div className="card mt-6 p-6">
        <ActionForm action={publicMaintenanceAction} submitLabel="Send report">
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Location</span>
              <select name="locationKey" required className="input" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {LOCATIONS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Unit number</span>
              <input name="unitName" required className="input" placeholder="e.g. 1D" />
            </label>
          </div>
          <label className="block">
            <span className="label">Name</span>
            <input name="name" required autoComplete="name" className="input" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Phone</span>
              <input name="phone" type="tel" autoComplete="tel" className="input" />
            </label>
            <label>
              <span className="label">Email</span>
              <input name="email" type="email" autoComplete="email" className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Problem type</span>
            <select name="issueType" required className="input">
              {ISSUE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">What happened?</span>
            <textarea name="description" required minLength={5} rows={4} className="input py-3" />
          </label>
          <label className="block">
            <span className="label">Photos (optional)</span>
            <input name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" />
          </label>
          <label className="block">
            <span className="label">How should we contact you?</span>
            <select name="contactPref" className="input">
              <option value="phone">Phone</option>
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="no_contact">No follow-up needed</option>
            </select>
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
