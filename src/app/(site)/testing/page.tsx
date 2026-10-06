import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Test environment",
  robots: { index: false, follow: false },
};

/**
 * Hosted simulator instructions. Only served when APP_TEST_MODE=1 so a live
 * production deploy never exposes test card numbers or demo passwords.
 */
export default function TestingPage() {
  if (!env.appTestMode) notFound();

  return (
    <div className="container-kv max-w-3xl py-12 sm:py-16">
      <p className="eyebrow">Simulator</p>
      <h1 className="h2 mt-2">Rental and portal test site</h1>
      <p className="mt-3 text-kv-muted">
        This is KV&apos;s own website simulator on a separate test database. It does not call live SiteLink, process real cards, send staff or GoHighLevel updates, or activate Nokē.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-kv-navy">Customer portal login</h2>
        <p className="mt-2 text-sm text-kv-muted">Use this account to open the tenant portal without completing a new rental first.</p>
        <dl className="mt-4 grid gap-3 rounded-2xl border border-kv-line bg-kv-navy-50 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kv-muted">Email</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-kv-navy">demo@kvselfstorage.ca</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-kv-muted">Password</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-kv-navy">demo1234</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-kv-muted">
          Haley Road shows an overdue balance; Stellarton has autopay on. Access codes are sample data only.
        </p>
        <Link href="/portal/login" className="btn-primary mt-5 inline-flex">
          Open portal sign-in
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-kv-navy">Simulated card payments</h2>
        <p className="mt-2 text-sm text-kv-muted">Use a future expiry, any 3-digit security code, and a fictional name and address. Never send these numbers to a live processor.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-kv-line text-kv-muted">
                <th className="py-2 pr-4 font-semibold">Simulator number</th>
                <th className="py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-kv-line">
                <td className="py-3 pr-4 font-mono">4242 4242 4242 4242</td>
                <td className="py-3">Approved fake rental</td>
              </tr>
              <tr className="border-b border-kv-line">
                <td className="py-3 pr-4 font-mono">4000 0000 0000 0002</td>
                <td className="py-3">Declined — no rental created</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono">4000 0000 0000 0119</td>
                <td className="py-3">Simulated timeout — no rental created</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-kv-muted">
          After an approved move-in, set a portal password on the confirmation page and sign in with that new email. Fake rentals stay in this test database across cold starts.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-kv-navy">What is blocked</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-kv-muted">
          <li>Live SiteLink SOAP calls (even if credentials exist in the host env)</li>
          <li>Staff notification webhooks</li>
          <li>GoHighLevel lead updates</li>
          <li>External pay-online links and paid AI chat</li>
          <li>Nokē remote unlock — portal never prompts for real app activation here</li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-kv-muted">
        Full notes: <code className="rounded bg-kv-navy-50 px-1.5 py-0.5 text-xs">docs/TEST_ENVIRONMENT.md</code>
      </p>
    </div>
  );
}
