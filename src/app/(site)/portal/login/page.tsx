import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { BRAND } from "@/config/locations";
import { getTenantSession } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Sign in to My storage", robots: { index: false } };

export default async function PortalLogin() {
  if (await getTenantSession()) redirect("/portal");
  return (
    <div className="container-kv max-w-md py-12 sm:py-20">
      <h1 className="h2">Sign in to your KV Self Storage account</h1>
      <p className="mt-2 text-sm text-kv-muted">Check your rental, payment and access details for your unit in Antigonish or Stellarton.</p>
      <div className="card mt-6 p-6">
        <ActionForm action={loginAction} submitLabel="Sign in" pendingLabel="Signing in..." hideOnSuccess={false}>
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required autoComplete="email" className="input" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm text-kv-muted">
        Need help signing in? Call{" "}
        <a href={`tel:${BRAND.phoneE164}`} className="font-semibold text-kv-red">
          {BRAND.phone}
        </a>
        .
      </p>
      <p className="mt-2 text-sm">
        <Link href="/maintenance" className="font-semibold text-kv-navy underline">
          Report a problem without signing in
        </Link>
      </p>
    </div>
  );
}
