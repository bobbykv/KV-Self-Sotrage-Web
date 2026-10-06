import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/locations";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="container-kv max-w-md py-12 sm:py-20">
      <h1 className="h2">Reset your storage account password</h1>
      <div className="card mt-6 space-y-4 p-6">
        <p className="text-kv-muted">
          Call us and we&apos;ll help you get back into your account. Have your email and unit number ready if you can.
        </p>
        <a href={`tel:${BRAND.phoneE164}`} className="btn-primary w-full text-center">
          Call {BRAND.phone}
        </a>
        <p className="text-sm text-kv-muted">
          Or email{" "}
          <a href={`mailto:${BRAND.email}`} className="font-semibold text-kv-red underline">
            {BRAND.email}
          </a>
          .
        </p>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/portal/login" className="font-semibold text-kv-navy underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
