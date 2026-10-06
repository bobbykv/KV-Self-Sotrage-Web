import Link from "next/link";
import { BRAND } from "@/config/locations";

export const metadata = { title: "Lease", robots: { index: false } };

export default function LeaseUnavailable() {
  return (
    <div className="container-kv max-w-xl py-16 text-center">
      <h1 className="h2">Your lease isn&apos;t available online yet</h1>
      <p className="mt-3 text-kv-muted">
        Need to review or sign your lease? Contact us at {BRAND.phone} or {BRAND.email} and we&apos;ll help you get a copy.
      </p>
      <Link href="/portal" className="btn-primary mt-6">
        Back to my account
      </Link>
    </div>
  );
}
