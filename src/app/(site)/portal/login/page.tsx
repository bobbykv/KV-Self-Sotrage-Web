import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { BRAND } from "@/config/locations";
import { getTenantSession } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Sign In to My Storage", robots: { index: false } };

export default async function PortalLogin() {
  if (await getTenantSession()) redirect("/portal");
  return (
    <div className="container-kv max-w-md py-12 sm:py-20">
      <p className="eyebrow">My storage</p>
      <h1 className="h2 mt-2">Sign in</h1>
      <p className="mt-2 text-sm text-kv-muted">Manage your storage in one place. Check your balance and access details, view your lease, or let us know when your plans change.</p>
      <div className="card mt-6 p-6">
        <ActionForm action={loginAction} submitLabel="Sign in" pendingLabel="Signing in…" hideOnSuccess={false}>
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
        Need help signing in or setting up your password? Call{" "}
        <a href={`tel:${BRAND.phoneE164}`} className="font-semibold text-kv-red">
          {BRAND.phone}
        </a>{" "}
        and we&apos;ll set it up. To report a problem without signing in, use our{" "}
        <Link href="/maintenance" className="font-semibold underline">
          maintenance form
        </Link>
        .
      </p>
    </div>
  );
}
