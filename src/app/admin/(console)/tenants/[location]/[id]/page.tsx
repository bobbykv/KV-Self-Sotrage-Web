import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Stat } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/catalog";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { loadPortalAccounts } from "@/lib/portal";
import { redact } from "@/lib/redact";
import { sitelink } from "@/lib/sitelink/client";

export const metadata = { title: "Tenant" };

export default async function TenantDetail({ params }: { params: Promise<{ location: string; id: string }> }) {
  const admin = await requireAdmin();
  const { location, id } = await params;
  const tenantId = Number(id);
  if (!isLocationKey(location) || !tenantId) notFound();
  const [account] = await loadPortalAccounts([{ locationKey: location, tenantId }]);
  if (!account.tenant && !account.error) notFound();
  await audit(admin.email, "tenant.view", `${location}:${tenantId}`);
  const [raw, holds, maint, transfers] = await Promise.all([
    sitelink.ledgers(location, tenantId).then((r) => r.raw).catch(() => []),
    db.hold.findMany({ where: { locationKey: location, tenantId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.maintenanceRequest.findMany({ where: { locationKey: location, tenantId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.transferRequest.findMany({ where: { locationKey: location, tenantId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const leases = await Promise.all(account.ledgers.map((l) => sitelink.leaseUrl(location, tenantId, l.ledgerId, `${env.APP_URL}/admin`).catch(() => null)));
  const t = account.tenant;

  return (
    <>
      <Link href="/admin/tenants" className="text-sm font-semibold text-kv-navy">
        ← Tenant lookup
      </Link>
      <PageHeader title={t ? `${t.firstName} ${t.lastName}` : `Tenant ${tenantId}`}>
        <span className="badge bg-kv-navy text-white">{getLocation(location).shortName}</span>
        <span className="badge bg-kv-navy-50 text-kv-navy">SiteLink tenant #{tenantId}</span>
      </PageHeader>
      {account.error && <p className="rounded-xl bg-kv-red-50 p-3 text-sm text-kv-red">{account.error}</p>}
      {t && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Email" value={<span className="text-sm">{t.email || "—"}</span>} />
          <Stat label="Phone" value={<span className="text-sm">{t.phone || "—"}</span>} />
          <Stat label="Access code" value={<span className="font-mono">{t.accessCode || "—"}</span>} />
          <Stat label="Autopay" value={account.billing ? (account.billing.autopay ? "On" : "Off") : "—"} sub={account.billing?.last4 ? `${account.billing.method} ••${account.billing.last4}` : undefined} />
        </div>
      )}

      <h2 className="mt-8 font-extrabold text-kv-navy">Units / ledgers</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {account.ledgers.map((l, i) => (
          <div key={l.ledgerId} className="card p-4">
            <div className="flex justify-between">
              <p className="font-mono text-lg font-bold">{l.unitName}</p>
              <p className={`font-extrabold ${l.pastDue > 0 ? "text-kv-red" : "text-kv-navy"}`}>{money(l.balance)}</p>
            </div>
            <p className="text-sm text-kv-muted">
              Rent {money(l.rent)} · paid thru {l.paidThrough?.slice(0, 10) ?? "—"} · ledger #{l.ledgerId}
            </p>
            {l.pastDue > 0 && <p className="mt-1 text-sm font-semibold text-kv-red">{money(l.pastDue)} past due ({l.daysPastDue} days)</p>}
            {l.scheduledMoveOut && <p className="mt-1 text-sm">Move-out scheduled {l.scheduledMoveOut.slice(0, 10)}</p>}
            {leases[i] ? (
              <a href={leases[i]!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-kv-red underline">
                Open lease (eSign)
              </a>
            ) : (
              <p className="mt-2 text-xs text-kv-muted">eSign lease not available for this ledger.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 text-sm">
          <h3 className="font-bold text-kv-navy">Website holds</h3>
          {holds.length ? holds.map((h) => <p key={h.id}>{h.createdAt.toLocaleDateString("en-CA")} · {h.unitName} · {h.status}</p>) : <p className="text-kv-muted">None</p>}
        </section>
        <section className="card p-4 text-sm">
          <h3 className="font-bold text-kv-navy">Maintenance</h3>
          {maint.length ? maint.map((m) => <p key={m.id}>{m.createdAt.toLocaleDateString("en-CA")} · {m.issueType} · {m.status}</p>) : <p className="text-kv-muted">None</p>}
        </section>
        <section className="card p-4 text-sm">
          <h3 className="font-bold text-kv-navy">Unit-change requests</h3>
          {transfers.length ? transfers.map((m) => <p key={m.id}>{m.createdAt.toLocaleDateString("en-CA")} · {m.direction} · {m.status}</p>) : <p className="text-kv-muted">None</p>}
        </section>
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer text-xs font-semibold text-kv-muted">Raw SiteLink ledger rows (go-live field mapping check)</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-kv-navy p-4 text-[11px] text-white">{JSON.stringify(redact(raw), null, 2)}</pre>
      </details>
    </>
  );
}
