import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";

export const metadata = { title: "Demo lease", robots: { index: false } };

/** Stand-in for the SiteLink eSign page when running with mock SiteLink data. */
export default function DemoLease() {
  if (env.sitelinkMode !== "mock") notFound();
  return (
    <div className="container-kv max-w-xl py-16 text-center">
      <h1 className="h2 mt-2">KV Self Storage demo lease</h1>
      <p className="mt-3 text-kv-muted">This is an example lease page. It does not create a rental agreement.</p>
      <Link href="/portal" className="btn-primary mt-6">
        Back to My storage
      </Link>
    </div>
  );
}
