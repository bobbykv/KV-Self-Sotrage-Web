import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { BRAND, LOCATIONS, getLocation } from "@/config/locations";
import { requireTenant } from "@/lib/auth";
import { money } from "@/lib/catalog";
import { env } from "@/lib/env";
import { loadPortalAccounts } from "@/lib/portal";
import { ISSUE_TYPES } from "@/lib/requests";
import { logoutAction, maintenanceAction, scheduleMoveOutAction, transferAction } from "./actions";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "UTC" }) : "—";
}

export default async function PortalDashboard() {
  const session = await requireTenant();
  const accounts = await loadPortalAccounts(session.links);
  const first = accounts.find((a) => a.tenant)?.tenant;
  const units = accounts.flatMap((a) => a.ledgers.map((l) => ({ ...l, locationKey: a.locationKey })));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container-kv py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tenant portal</p>
          <h1 className="h2 mt-1">Hi{first ? `, ${first.firstName}` : ""}</h1>
          <p className="text-sm text-kv-muted">{session.email}</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      {accounts.map((a) => (
        <section key={a.locationKey} className="mt-8">
          <h2 className="text-lg font-extrabold text-kv-navy">{a.locationName}</h2>
          {a.error && <p className="mt-2 rounded-xl bg-kv-yellow-light p-4 text-sm">We couldn&apos;t load this account right now. Please try again shortly or call {BRAND.phone}.</p>}

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {a.ledgers.map((l) => (
              <article key={l.ledgerId} className="card p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-kv-muted">Unit</p>
                    <p className="text-2xl font-extrabold text-kv-navy">{l.unitName}</p>
                    <p className="text-sm text-kv-muted">
                      {money(l.rent)}/month · paid through {fmtDate(l.paidThrough)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-kv-muted">Balance</p>
                    <p className={`text-2xl font-extrabold ${l.pastDue > 0 ? "text-kv-red" : "text-kv-navy"}`}>{money(l.balance)}</p>
                    {l.pastDue > 0 ? (
                      <p className="badge mt-1 bg-kv-red text-white">
                        {money(l.pastDue)} past due{l.daysPastDue ? ` · ${l.daysPastDue} days` : ""}
                      </p>
                    ) : (
                      <p className="badge mt-1 bg-kv-navy-50 text-kv-navy">Up to date</p>
                    )}
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-kv-navy-50 p-4">
                    <dt className="text-xs font-semibold text-kv-muted">Gate / access code</dt>
                    <dd className="mt-1 font-mono text-2xl font-bold tracking-widest text-kv-navy">{l.accessCode || "—"}</dd>
                    {!l.accessCode && <p className="text-xs text-kv-muted">Issued once your move-in is processed.</p>}
                  </div>
                  <div className="rounded-xl bg-kv-navy-50 p-4">
                    <dt className="text-xs font-semibold text-kv-muted">Autopay</dt>
                    <dd className="mt-1 font-bold text-kv-navy">{a.billing ? (a.billing.autopay ? "On" : "Off") : "Unknown"}</dd>
                    {a.billing?.autopay && (
                      <p className="text-xs text-kv-muted">
                        {a.billing.method}
                        {a.billing.last4 ? ` ending ${a.billing.last4}` : ""}
                        {a.billing.expires ? ` · exp ${new Date(a.billing.expires).toLocaleDateString("en-CA", { month: "2-digit", year: "2-digit", timeZone: "UTC" })}` : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-kv-muted">To change autopay, call the office.</p>
                  </div>
                  <div className="rounded-xl bg-kv-navy-50 p-4">
                    <dt className="text-xs font-semibold text-kv-muted">Lease</dt>
                    <dd className="mt-1">
                      <a href={`/api/portal/lease?location=${a.locationKey}&ledger=${l.ledgerId}`} className="font-bold text-kv-red underline">
                        View / sign lease
                      </a>
                    </dd>
                    <p className="text-xs text-kv-muted">If it isn&apos;t set up online, we&apos;ll email it.</p>
                  </div>
                </dl>

                {a.noke && (
                  <p className="mt-4 rounded-xl border border-kv-yellow bg-kv-yellow-light p-3 text-sm text-kv-navy">
                    <strong>Noke smart lock site.</strong> Remote unlock from your phone is available here through the Noke app — unlocking right from this portal is coming soon.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {env.PAY_ONLINE_URL && (
                    <a href={env.PAY_ONLINE_URL} className="btn-primary btn-sm min-h-11" target="_blank" rel="noopener noreferrer">
                      Make a payment
                    </a>
                  )}
                  <a href={`tel:${BRAND.phoneE164}`} className="btn-ghost btn-sm min-h-11">
                    Call the office
                  </a>
                </div>

                <details className="mt-5 rounded-xl border border-kv-line p-4">
                  <summary className="cursor-pointer font-semibold text-kv-navy">{l.scheduledMoveOut ? `Move-out scheduled: ${fmtDate(l.scheduledMoveOut)}` : "Schedule a move-out"}</summary>
                  <div className="mt-3 max-w-sm">
                    <p className="mb-3 text-sm text-kv-muted">
                      Scheduling tells us your plans — the unit isn&apos;t closed out until staff process the move-out on that date. Please have it empty and your lock removed.
                    </p>
                    <ActionForm action={scheduleMoveOutAction} submitLabel="Schedule move-out" buttonClassName="btn-navy w-full">
                      <input type="hidden" name="locationKey" value={a.locationKey} />
                      <input type="hidden" name="ledgerId" value={l.ledgerId} />
                      <input type="date" name="date" min={today} required className="input" aria-label="Move-out date" />
                    </ActionForm>
                  </div>
                </details>
              </article>
            ))}
            {!a.ledgers.length && !a.error && <p className="text-sm text-kv-muted">No active units on this account.</p>}
          </div>
        </section>
      ))}

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="card p-6" id="maintenance">
          <h2 className="text-lg font-extrabold text-kv-navy">Report a maintenance issue</h2>
          <p className="mt-1 text-sm text-kv-muted">Goes straight to the owner&apos;s maintenance list. Emergency? Call {BRAND.phone}.</p>
          <div className="mt-4">
            <ActionForm action={maintenanceAction} submitLabel="Send request">
              <UnitPicker units={units} />
              <input type="hidden" name="name" value={first ? `${first.firstName} ${first.lastName}` : session.email} />
              <input type="hidden" name="phone" value={first?.phone ?? ""} />
              <label className="block">
                <span className="label">What&apos;s the issue?</span>
                <select name="issueType" required className="input">
                  {ISSUE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Describe it</span>
                <textarea name="description" required minLength={5} rows={4} className="input py-3" />
              </label>
              <label className="block">
                <span className="label">Photos (optional, up to 3, about 4 MB total)</span>
                <input name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" />
              </label>
              <ContactPref />
            </ActionForm>
          </div>
        </section>

        <section className="card p-6" id="transfer">
          <h2 className="text-lg font-extrabold text-kv-navy">Request a unit change</h2>
          <p className="mt-1 text-sm text-kv-muted">Need more or less space? Tell us and we&apos;ll check what&apos;s open — no phone tag.</p>
          <div className="mt-4">
            <ActionForm action={transferAction} submitLabel="Send request">
              <UnitPicker units={units} field="currentUnitName" />
              <label className="block">
                <span className="label">I&apos;d like</span>
                <select name="direction" className="input">
                  <option value="bigger">A bigger unit</option>
                  <option value="smaller">A smaller unit</option>
                  <option value="different_type">A different type (e.g. climate, parking)</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Where</span>
                <select name="desiredLocation" className="input">
                  <option value="same">Same location</option>
                  {LOCATIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.shortName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="label">Size (optional)</span>
                  <input name="desiredSize" placeholder="e.g. 10x15" className="input" />
                </label>
                <label>
                  <span className="label">When</span>
                  <select name="timing" className="input">
                    <option value="asap">As soon as possible</option>
                    <option value="within_month">Within a month</option>
                    <option value="flexible">I&apos;m flexible</option>
                    <option value="specific_date">A specific date (add below)</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="label">Anything else? (optional)</span>
                <textarea name="reason" rows={3} className="input py-3" />
              </label>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}

function UnitPicker({ units, field = "unitName" }: { units: { locationKey: string; unitName: string; ledgerId: number }[]; field?: string }) {
  if (units.length <= 1) {
    const u = units[0];
    return (
      <>
        <input type="hidden" name="locationKey" value={u?.locationKey ?? ""} />
        <input type="hidden" name={field} value={u?.unitName ?? ""} />
        {u && (
          <p className="text-sm">
            Unit <strong>{u.unitName}</strong> · {getLocation(u.locationKey as "haley").shortName}
          </p>
        )}
      </>
    );
  }
  return (
    <UnitSelect units={units} field={field} />
  );
}

function UnitSelect({ units, field }: { units: { locationKey: string; unitName: string; ledgerId: number }[]; field: string }) {
  return (
    <fieldset>
      <legend className="label">Which unit?</legend>
      <div className="space-y-2">
        {units.map((u, i) => (
          <label key={u.ledgerId} className="flex items-center gap-3 rounded-xl border border-kv-line px-4 py-3">
            <input type="radio" name="unitChoice" value={`${u.locationKey}|${u.unitName}`} defaultChecked={i === 0} required className="accent-kv-red" />
            <span>
              {u.unitName} · {getLocation(u.locationKey as "haley").shortName}
            </span>
          </label>
        ))}
      </div>
      <input type="hidden" name="_unitField" value={field} />
    </fieldset>
  );
}

function ContactPref() {
  return (
    <label className="block">
      <span className="label">How should we follow up?</span>
      <select name="contactPref" className="input">
        <option value="phone">Phone call</option>
        <option value="text">Text message</option>
        <option value="email">Email</option>
        <option value="no_contact">No need — just fix it</option>
      </select>
    </label>
  );
}
