import Link from "next/link";
import { BRAND } from "@/config/locations";

export const metadata = { title: "Lease", robots: { index: false } };

export default function LeaseUnavailable() {
  return (
    <div className="container-kv max-w-xl py-16 text-center">
      <h1 className="h2">Your KV Self Storage lease isn&apos;t available here</h1>
      <p className="mt-3 text-kv-muted">
        Call {BRAND.phone} or email {BRAND.email}. We&apos;ll help you get your lease.
      </p>
      <Link href="/portal" className="btn-primary mt-6">
        Back to My storage
      </Link>
    </div>
  );
}
