import { PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { retryLeadAction } from "../actions";

export const metadata = { title: "Leads" };

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ channel?: string; ghl?: string }> }) {
  const sp = await searchParams;
  const leads = await db.lead.findMany({
    where: { ...(sp.channel ? { channel: sp.channel } : {}), ...(sp.ghl ? { ghlStatus: sp.ghl } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const ghlConfigured = Boolean(env.GHL_WEBHOOK_URL || (env.GHL_API_KEY && env.GHL_LOCATION_ID));
  return (
    <>
      <PageHeader title="Leads → GoHighLevel">
        <a href={`/admin/leads/export${sp.channel ? `?channel=${sp.channel}` : ""}`} className="btn-ghost btn-sm">
          Export CSV
        </a>
      </PageHeader>
      {!ghlConfigured && (
        <p className="mb-4 rounded-xl bg-kv-yellow-light p-3 text-sm">GoHighLevel isn&apos;t configured (set GHL_WEBHOOK_URL, or GHL_API_KEY + GHL_LOCATION_ID). Leads are saved here and marked &ldquo;skipped&rdquo; until then.</p>
      )}
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <select name="channel" defaultValue={sp.channel ?? ""} className="input min-h-10 w-auto">
          <option value="">All channels</option>
          <option value="website_form">Website form</option>
          <option value="website_chat">Website chat</option>
          <option value="retell">Retell phone</option>
          <option value="voice">Voice</option>
        </select>
        <select name="ghl" defaultValue={sp.ghl ?? ""} className="input min-h-10 w-auto">
          <option value="">Any GHL status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <button className="btn-ghost btn-sm min-h-10">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-kv-navy-50 text-left text-xs text-kv-muted">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Who</th>
              <th className="p-3">Wants</th>
              <th className="p-3">Channel / reason</th>
              <th className="p-3">GHL</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-kv-line align-top">
                <td className="p-3 text-xs whitespace-nowrap">{l.createdAt.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-3">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-xs text-kv-muted">{[l.phone, l.email].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="p-3">
                  <p>{[isLocationKey(l.locationKey) ? getLocation(l.locationKey).shortName : "Any site", l.unitSize, l.unitType].filter(Boolean).join(" · ")}</p>
                  {l.notes && <p className="text-xs text-kv-muted">{l.notes}</p>}
                </td>
                <td className="p-3 text-xs">
                  {l.channel}
                  <br />
                  {l.reason.replace(/_/g, " ")}
                </td>
                <td className="p-3">
                  <StatusBadge status={l.ghlStatus} />
                  {l.ghlError && <p className="mt-1 text-[11px] text-kv-muted">{l.ghlError}</p>}
                  {l.ghlStatus !== "sent" && ghlConfigured && (
                    <form action={retryLeadAction.bind(null, l.id)}>
                      <button className="mt-1 text-xs font-semibold text-kv-red underline">Retry</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!leads.length && <p className="p-4 text-sm text-kv-muted">No leads yet.</p>}
      </div>
    </>
  );
}
