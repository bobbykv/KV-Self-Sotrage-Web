import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { completeAccessAction } from "@/app/(site)/portal/access/actions";
export const metadata: Metadata = { title: "Choose your account password", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Outside the site layout so reset credentials are not exposed to chat widgets.
export default async function AccountPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
  return <main className="container-kv max-w-md py-16"><Link href="/" className="font-bold text-kv-navy">KV Self Storage</Link><h1 className="h2 mt-8">Choose your account password</h1>
    {valid ? <div className="card mt-6 p-6"><ActionForm action={completeAccessAction} submitLabel="Save password" pendingLabel="Saving…">
      <input type="hidden" name="token" value={token} /><p className="text-sm text-kv-muted">Use 12–128 characters, including a letter and a number.</p>
      <label className="block"><span className="label">New password</span><input className="input" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label className="block"><span className="label">Confirm password</span><input className="input" type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    </ActionForm></div> : <p className="mt-6">This link is invalid. Please request a new one.</p>}
    <Link href="/portal/login" className="mt-6 block font-semibold underline">Sign in to My storage</Link><Link href="/portal/access" className="mt-4 block underline">Request a new secure link</Link>
  </main>;
}
