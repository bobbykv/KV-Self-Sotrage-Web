import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";

export const metadata = { title: "Demo lease", robots: { index: false } };

/** Stand-in for the SiteLink eSign page when running with mock SiteLink data. */
export default function DemoLease() {
  if (env.sitelinkMode !== "mock") notFound();
  return (
    <div className="container-kv max-w-xl py-16 text-center">
      <p className="eyebrow">Demo mode</p>
      <h1 className="h2 mt-2">Preview your lease-signing step</h1>
      <p className="mt-3 text-kv-muted">This is a demonstration, so there is no rental agreement to sign. For a real rental, this step will let you review and sign your lease.</p>
      <Link href="/portal" className="btn-primary mt-6">
        Back to my account
      </Link>
    </div>
  );
}
