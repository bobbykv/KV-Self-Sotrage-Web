import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { BRAND, LOCATIONS } from "@/config/locations";
import { ISSUE_TYPES } from "@/lib/requests";
import { publicMaintenanceAction } from "./actions";

export const metadata: Metadata = {
  title: "Report a maintenance issue",
  description: "KV Self Storage tenants can report a maintenance issue online — no phone call needed.",
};

export default function MaintenancePage() {
  return (
    <div className="container-kv max-w-2xl py-10 sm:py-16">
      <p className="eyebrow">Tenants</p>
      <h1 className="h2 mt-2">Report a maintenance issue</h1>
      <p className="mt-2 text-kv-muted">
        Door sticking, light out, gate trouble? Tell us here and it goes straight to the owner&apos;s maintenance list. Signed-in tenants can also use the{" "}
        <Link href="/portal#maintenance" className="font-semibold underline">
          portal
        </Link>
        . Emergency (water, break-in)? Call{" "}
        <a href={`tel:${BRAND.phoneE164}`} className="font-bold text-kv-red">
          {BRAND.phone}
        </a>
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
            <span className="label">Your name (as on your lease)</span>
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
            <span className="label">Issue type</span>
            <select name="issueType" required className="input">
              {ISSUE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">What&apos;s going on?</span>
            <textarea name="description" required minLength={5} rows={4} className="input py-3" />
          </label>
          <label className="block">
            <span className="label">Photos (optional, up to 3, about 4 MB total)</span>
            <input name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" />
          </label>
          <label className="block">
            <span className="label">How should we follow up?</span>
            <select name="contactPref" className="input">
              <option value="phone">Phone call</option>
              <option value="text">Text message</option>
              <option value="email">Email</option>
              <option value="no_contact">No need — just fix it</option>
            </select>
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
