import Link from "next/link";
import { LocationSwitcher, PageHeader } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey, LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/log";
import { sitelink } from "@/lib/sitelink/client";
import type { Tenant } from "@/lib/sitelink/types";

export const metadata = { title: "Tenants" };

/** Live SiteLink search across every location in one go — no switching between three SiteLink windows. */
async function search(locs: LocationKey[], q: string) {
  const isEmail = q.includes("@");
  const digits = q.replace(/\D/g, "");
  const isPhone = digits.length >= 7 && digits.length === q.replace(/[\s()+-]/g, "").length;
  const isUnit = /^[a-z]?\d+[a-z0-9-]*$/i.test(q) && !isPhone;
  const [first, ...rest] = q.split(/\s+/);
  return Promise.all(
    locs.map(async (loc) => {
      try {
        let tenants: Tenant[] = [];
        if (isUnit) {
          const id = await sitelink.tenantIdByUnitName(loc, q);
          const info = id ? await sitelink.tenantInfo(loc, id) : null;
          tenants = info ? [info.tenant] : [];
        } else if (isEmail) tenants = await sitelink.searchTenants(loc, { email: q });
        else if (isPhone) tenants = await sitelink.searchTenants(loc, { phone: digits });
        else tenants = await sitelink.searchTenants(loc, rest.length ? { firstName: first, lastName: rest.join(" ") } : { lastName: q });
        return { loc, tenants, error: null as string | null };
      } catch (err) {
        return { loc, tenants: [] as Tenant[], error: safeErrorMessage(err, 120) };
      }
    }),
  );
}

export default async function AdminTenants({ searchParams }: { searchParams: Promise<{ location?: string; q?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const location = isLocationKey(sp.location) ? sp.location : undefined;
  const q = (sp.q ?? "").trim();
  const results = q.length >= 2 ? await search(location ? [location] : [...LOCATION_KEYS], q) : null;
  if (results) await audit(admin.email, "tenant.search", q.slice(0, 60), { location: location ?? "all" });

  return (
    <>
      <PageHeader title="Tenant lookup" />
      <LocationSwitcher current={location} basePath="/admin/tenants" extra={q ? `q=${encodeURIComponent(q)}` : ""} />
      <form method="get" className="mt-4 flex flex-wrap gap-2">
        {location && <input type="hidden" name="location" value={location} />}
        <input name="q" defaultValue={q} placeholder="Name, email, phone or unit #" className="input max-w-md" autoFocus />
        <button className="btn-navy">Search {location ? getLocation(location).shortName : "all sites"}</button>
      </form>
      <p className="mt-2 text-xs text-kv-muted">Searches SiteLink live (one call per site). Unit numbers look up the current tenant of that unit.</p>

      {results && (
        <div className="mt-6 space-y-6">
          {results.map((r) => (
            <section key={r.loc}>
              <h2 className="font-extrabold text-kv-navy">
                {getLocation(r.loc).shortName} <span className="text-sm font-normal text-kv-muted">({r.tenants.length})</span>
              </h2>
              {r.error && <p className="mt-1 text-sm text-kv-red">{r.error}</p>}
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {r.tenants.map((t) => (
                  <Link key={t.tenantId} href={`/admin/tenants/${r.loc}/${t.tenantId}`} className="card block p-4 hover:border-kv-navy">
                    <p className="font-bold text-kv-navy">
                      {t.firstName} {t.lastName}
                      {t.company && <span className="font-normal text-kv-muted"> · {t.company}</span>}
                    </p>
                    <p className="text-sm text-kv-muted">
                      {t.email || "no email"} · {t.phone || "no phone"}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
