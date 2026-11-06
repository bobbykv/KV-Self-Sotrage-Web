import Link from "next/link";
import { LOCATIONS } from "@/config/locations";
import { ActionForm } from "./ActionForm";
import { requestAccessAction } from "@/app/(site)/portal/access/actions";
export function PortalAccessForm({ reset = false }: { reset?: boolean }) {
  return <div className="container-kv max-w-md py-12 sm:py-20">
    <h1 className="h2">{reset ? "Reset your password" : "Set up online access"}</h1>
    <p className="mt-3 text-sm text-kv-muted">Already renting with KV Self Storage? Enter the details on your rental. We’ll email you a secure link to choose a password.</p>
    <div className="card mt-6 p-6"><ActionForm action={requestAccessAction} submitLabel="Email my secure link">
      <label className="block"><span className="label">Storage location</span><select name="location" required className="input" defaultValue=""><option value="" disabled>Choose your location</option>{LOCATIONS.map(l => <option key={l.key} value={l.key}>{l.cardTitle}</option>)}</select></label>
      <label className="block"><span className="label">Unit number</span><input name="unit" required maxLength={40} autoComplete="off" className="input" /></label>
      <label className="block"><span className="label">Email on your rental</span><input name="email" type="email" autoComplete="email" required maxLength={254} className="input" /></label>
    </ActionForm></div>
    <p className="mt-5 text-sm text-kv-muted">No email on file, changed email, or not sure of your unit number? Call <a href="tel:+19028673779" className="underline">(902) 867-3779</a> so we can verify your account and help.</p>
    <Link href="/portal/login" className="mt-5 inline-block font-semibold underline">Back to sign in</Link>
  </div>;
}
