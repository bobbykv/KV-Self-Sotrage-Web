import { PageHeader } from "@/components/admin/LocationSwitcher";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { changePasswordAction, createStaffAction, saveSettingsAction } from "../actions";

export const metadata = { title: "Settings" };

function NumberField({ name, label, value, min, max, hint }: { name: string; label: string; value: number; min: number; max: number; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="number" min={min} max={max} defaultValue={value} className="input" />
      {hint && <p className="mt-1 text-xs text-kv-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminSettings() {
  const admin = await requireAdmin();
  const [s, staff, logs] = await Promise.all([
    getSettings(),
    db.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true, lastLoginAt: true, lockedUntil: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const when = (d: Date | null) => (d ? d.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium", timeStyle: "short" }) : "—");

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold text-kv-navy">Feature flags</h2>
          <ActionForm action={saveSettingsAction} submitLabel="Save settings" pendingLabel="Saving…" buttonClassName="btn-primary" hideOnSuccess={false} className="card space-y-4 p-5">
            <label className="flex items-center gap-2 font-semibold text-kv-navy">
              <input type="checkbox" name="maintenanceMode" defaultChecked={s.maintenanceMode} className="h-5 w-5" /> Maintenance mode (pauses online holds and checkout)
            </label>
            <div>
              <label className="label" htmlFor="maintenanceMessage">Maintenance banner message</label>
              <textarea id="maintenanceMessage" name="maintenanceMessage" rows={2} maxLength={300} defaultValue={s.maintenanceMessage} className="input py-2" />
            </div>
            <label className="flex items-center gap-2 font-semibold text-kv-navy">
              <input type="checkbox" name="chatEnabled" defaultChecked={s.chatEnabled} className="h-5 w-5" /> Website chat enabled
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField name="holdMinutes" label="Hold length (minutes)" value={s.holdMinutes} min={5} max={60} />
              <NumberField name="confirmedReservationHours" label="Pay-separately reservation (hours)" value={s.confirmedReservationHours} min={1} max={168} hint="How long a confirmed web reservation stays on the SiteLink waiting list." />
              <NumberField name="pollIntervalMinutes" label="Vacant-unit poll (minutes)" value={s.pollIntervalMinutes} min={30} max={720} hint="Minimum 30. Used when a refresh runs. Automatic scheduling is off on the free Vercel plan — use Refresh SiteLink cache." />
              <NumberField name="allUnitsPollMinutes" label="All-units poll (minutes)" value={s.allUnitsPollMinutes} min={30} max={1440} />
              <NumberField name="priceListPollMinutes" label="Price list poll (minutes)" value={s.priceListPollMinutes} min={30} max={1440} />
            </div>
          </ActionForm>

          <h2 className="mt-6 mb-3 text-lg font-bold text-kv-navy">Environment (read only)</h2>
          <dl className="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
            <dt className="font-semibold">App test mode</dt>
            <dd>{env.appTestMode ? "On — live SiteLink, GHL, staff webhooks and Nokē activation are blocked" : "Off"}</dd>
            <dt className="font-semibold">SiteLink</dt>
            <dd>{env.sitelinkMode === "mock" ? "Mock (demo data)" : `Live${env.sitelinkTestMode ? " · test mode" : ""}`}</dd>
            <dt className="font-semibold">Payment mode</dt>
            <dd>{env.PAYMENT_MODE === "passthrough" ? (env.appTestMode ? "Simulated card payments (APP_TEST_MODE)" : "Card pass-through to SiteLink") : "Pay separately (no card on website)"}</dd>
            <dt className="font-semibold">HST rate</dt>
            <dd>{(env.HST_RATE * 100).toFixed(1)}% (used only if SiteLink doesn&apos;t return tax lines)</dd>
            <dt className="font-semibold">GoHighLevel</dt>
            <dd>{env.GHL_WEBHOOK_URL || (env.GHL_API_KEY && env.GHL_LOCATION_ID) ? "Configured" : "Not configured — leads are stored here only"}</dd>
            <dt className="font-semibold">Chat LLM</dt>
            <dd>{env.CHAT_LLM_API_KEY ? `Configured (${env.CHAT_LLM_MODEL})` : "Not configured — rules-based answers"}</dd>
            <dt className="font-semibold">Staff alerts</dt>
            <dd>{env.NOTIFY_WEBHOOK_URL ? "Webhook configured" : "Not configured"}</dd>
          </dl>
          <p className="mt-2 text-xs text-kv-muted">Credentials live in the hosting provider&apos;s environment variables and are never shown here.</p>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-bold text-kv-navy">Staff accounts</h2>
            <div className="card divide-y divide-kv-line">
              {staff.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-kv-navy">
                      {u.name} <span className="badge bg-kv-navy-50 text-kv-navy">{u.role}</span>
                      {u.lockedUntil && u.lockedUntil > new Date() && <span className="badge ml-1 bg-kv-red text-white">locked</span>}
                    </p>
                    <p className="text-kv-muted">{u.email}</p>
                  </div>
                  <p className="text-xs text-kv-muted">Last sign-in {when(u.lastLoginAt)}</p>
                </div>
              ))}
            </div>
            {admin.role === "owner" && (
              <ActionForm action={createStaffAction} submitLabel="Add staff account" pendingLabel="Creating…" buttonClassName="btn-navy" hideOnSuccess={false} className="card mt-3 space-y-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="staff-name">Name</label>
                    <input id="staff-name" name="name" required className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="staff-email">Email</label>
                    <input id="staff-email" name="email" type="email" required className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="staff-password">Temporary password</label>
                    <input id="staff-password" name="password" type="password" required minLength={12} autoComplete="new-password" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="staff-role">Role</label>
                    <select id="staff-role" name="role" className="input">
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-kv-muted">At least 12 characters using 3 of: lowercase, uppercase, numbers, symbols.</p>
              </ActionForm>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-kv-navy">Change your password</h2>
            <ActionForm action={changePasswordAction} submitLabel="Change password" pendingLabel="Saving…" buttonClassName="btn-navy" className="card space-y-3 p-5">
              <div>
                <label className="label" htmlFor="current">Current password</label>
                <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="next">New password</label>
                <input id="next" name="next" type="password" required minLength={12} autoComplete="new-password" className="input" />
              </div>
              <p className="text-xs text-kv-muted">You&apos;ll be signed out everywhere and asked to sign in again.</p>
            </ActionForm>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-kv-navy">Recent activity</h2>
            <div className="card max-h-[28rem] divide-y divide-kv-line overflow-auto text-sm">
              {!logs.length && <p className="p-3 text-kv-muted">No activity yet.</p>}
              {logs.map((l) => (
                <div key={l.id} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    <strong className="text-kv-navy">{l.action}</strong> {l.target && <span className="text-kv-muted">· {l.target}</span>}
                  </span>
                  <span className="text-xs text-kv-muted">
                    {l.actor} · {when(l.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
