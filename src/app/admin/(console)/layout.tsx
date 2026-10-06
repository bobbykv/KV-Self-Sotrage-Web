import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { adminLogout } from "./actions";

export const metadata: Metadata = { title: { default: "Staff console", template: "%s · KV staff" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/units", label: "Units" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/holds", label: "Holds & payments" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/transfers", label: "Unit changes" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/faq", label: "FAQ / chat brain" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-kv-navy-50/60 lg:flex">
      <aside className="bg-kv-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/admin" className="block">
            <p className="text-lg font-extrabold">KV Staff</p>
            <p className="text-xs text-white/60">All locations · SiteLink {env.sitelinkMode === "mock" ? "(DEMO DATA)" : "live"}</p>
          </Link>
          <Link href="/" className="text-xs text-kv-yellow underline lg:mt-2 lg:inline-block">
            View site
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-col lg:overflow-visible" aria-label="Staff">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 rounded-lg px-3 py-2 font-semibold text-white/85 hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-4 text-xs text-white/60 lg:absolute lg:bottom-0 lg:block">
          <p>{admin.name}</p>
          <p>{admin.email}</p>
          <form action={adminLogout}>
            <button className="mt-2 text-kv-yellow underline">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {env.sitelinkMode === "mock" && (
          <p className="bg-kv-yellow px-4 py-2 text-center text-xs font-bold text-kv-navy">Demo mode: SiteLink is mocked. Add SiteLink credentials to go live.</p>
        )}
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        <form action={adminLogout} className="px-4 pb-6 lg:hidden">
          <button className="text-sm font-semibold text-kv-muted underline">Sign out ({admin.email})</button>
        </form>
      </div>
    </div>
  );
}
