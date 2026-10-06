import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { BRAND, LOCATIONS, getLocation } from "@/config/locations";
import { requireTenant } from "@/lib/auth";
import { money } from "@/lib/catalog";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { loadPortalAccounts } from "@/lib/portal";
import { ISSUE_TYPES } from "@/lib/requests";
import { cancelMoveOutAction, logoutAction, maintenanceAction, scheduleMoveOutAction, transferAction } from "./actions";
import { PortalPayForm } from "./PortalPayForm";
import { TimingFields } from "./TimingFields";

export const metadata: Metadata = { title: "My storage account", robots: { index: false } };

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "UTC" }) : "Not available";
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function expiryMMYY(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function balanceBreakdown(rent: number, balance: number, pastDue: number, paidThrough: string | null, hstRate: number) {
  const rentPortion = rent;
  const hstPortion = Math.round(rent * hstRate * 100) / 100;
  const withTax = Math.round(rent * (1 + hstRate) * 100) / 100;
  const lateFee = pastDue > rentPortion ? Math.round((pastDue - rentPortion) * 100) / 100 : 0;
  const dueDate = paidThrough ? addMonths(paidThrough, 0) : null; // paidThrough is the last covered day; due next day conceptually shown as paidThrough
  const periodStart = paidThrough;
  const periodEnd = paidThrough ? addMonths(paidThrough, 1).toISOString() : null;
  const nextCharge = paidThrough ? addMonths(paidThrough, 1) : null;
  return { rentPortion, hstPortion, withTax, lateFee, dueDate, periodStart, periodEnd, nextCharge, balance };
}

export default async function PortalDashboard() {
  const session = await requireTenant();
  const accounts = await loadPortalAccounts(session.links);
  const first = accounts.find((a) => a.tenant)?.tenant;
  const units = accounts.flatMap((a) => a.ledgers.map((l) => ({ ...l, locationKey: a.locationKey })));
  const today = new Date().toISOString().slice(0, 10);
  const canPayOnline = env.PAYMENT_MODE === "passthrough" || Boolean(env.PAY_ONLINE_URL);

  const receipts = await db.paymentReceipt.findMany({
    where: {
      OR: session.links.map((l) => ({ tenantId: l.tenantId, locationKey: l.locationKey })),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const demoHistory =
    env.appTestMode || env.sitelinkMode === "mock"
      ? [
          { id: "demo-1", createdAt: new Date(Date.now() - 40 * 86_400_000), description: "Monthly rent (demo)", amount: 95, paymentRef: "DEMO-001", periodLabel: "Previous period" },
          { id: "demo-2", createdAt: new Date(Date.now() - 70 * 86_400_000), description: "Monthly rent (demo)", amount: 95, paymentRef: "DEMO-002", periodLabel: "Earlier period" },
        ]
      : [];

  const history = [
    ...receipts.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      description: r.description,
      amount: Number(r.amount),
      paymentRef: r.paymentRef,
      periodLabel: r.periodLabel,
    })),
    ...demoHistory,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="container-kv py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My storage</p>
          <h1 className="h2 mt-1">Your KV Self Storage account</h1>
          <p className="mt-1 text-sm text-kv-muted">Hi{first ? ` ${first.firstName}` : ""}.</p>
          <p className="text-sm text-kv-muted">{session.email}</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      {accounts.map((a) => (
        <section key={a.locationKey} className="mt-8">
          <h2 className="text-lg font-extrabold text-kv-navy">Your unit at {a.locationName}</h2>
          {a.error && <p className="mt-2 rounded-xl bg-kv-yellow-light p-4 text-sm">We couldn&apos;t load your account. Try again or call {BRAND.phone}.</p>}

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {a.ledgers.map((l) => {
              const bd = balanceBreakdown(l.rent, l.balance, l.pastDue, l.paidThrough, env.HST_RATE);
              return (
                <article key={l.ledgerId} className="card p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-kv-muted">Unit</p>
                      <p className="text-2xl font-extrabold text-kv-navy">{l.unitName}</p>
                      <p className="text-sm text-kv-muted">Monthly rent {money(l.rent)} + HST</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-kv-muted">Balance due{bd.dueDate ? ` · due ${fmtDate(bd.dueDate.toISOString())}` : ""}</p>
                      <p className={`text-2xl font-extrabold ${l.pastDue > 0 || l.balance > 0 ? "text-kv-red" : "text-kv-navy"}`}>{money(l.balance)}</p>
                      {l.pastDue > 0 ? (
                        <p className="badge mt-1 bg-kv-red text-white">
                          Past-due amount {money(l.pastDue)}
                          {l.daysPastDue ? ` · ${l.daysPastDue} days` : ""}
                        </p>
                      ) : (
                        <p className="badge mt-1 bg-kv-navy-50 text-kv-navy">Up to date</p>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-2 rounded-xl bg-kv-navy-50 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-kv-muted">Rent</dt>
                      <dd className="font-semibold">{money(bd.rentPortion)}</dd>
                    </div>
                    <div>
                      <dt className="text-kv-muted">HST ({Math.round(env.HST_RATE * 100)}%)</dt>
                      <dd className="font-semibold">{money(bd.hstPortion)}</dd>
                    </div>
                    <div>
                      <dt className="text-kv-muted">Rent + HST</dt>
                      <dd className="font-semibold">{money(bd.withTax)}</dd>
                    </div>
                    {bd.lateFee > 0 && (
                      <div>
                        <dt className="text-kv-muted">Late fee (est.)</dt>
                        <dd className="font-semibold text-kv-red">{money(bd.lateFee)}</dd>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <dt className="text-kv-muted">Period covered</dt>
                      <dd className="font-semibold">
                        {bd.periodStart ? `${fmtDate(bd.periodStart)}` : "—"}
                        {bd.periodEnd ? ` to ${fmtDate(bd.periodEnd)}` : ""}
                        {!bd.periodStart && "Not available"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-kv-muted">Paid through</dt>
                      <dd className="font-semibold">{fmtDate(l.paidThrough)}</dd>
                    </div>
                  </dl>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-kv-navy-50 p-4">
                      <dt className="text-xs font-semibold text-kv-muted">Gate code</dt>
                      <dd className="mt-1 font-mono text-2xl font-bold tracking-widest text-kv-navy">{l.accessCode || "—"}</dd>
                      {!l.accessCode && <p className="text-xs text-kv-muted">Your access details aren&apos;t shown yet. Follow your rental instructions or call {BRAND.phone}.</p>}
                    </div>
                    <div className="rounded-xl bg-kv-navy-50 p-4">
                      <dt className="text-xs font-semibold text-kv-muted">Autopay</dt>
                      <dd className="mt-1 font-bold text-kv-navy">{a.billing ? (a.billing.autopay ? "On" : "Off") : "Contact us to confirm"}</dd>
                      {a.billing?.autopay && (
                        <>
                          <p className="text-xs text-kv-muted">
                            {a.billing.method}
                            {a.billing.last4 ? ` ending ${a.billing.last4}` : ""}
                            {expiryMMYY(a.billing.expires) ? ` · exp ${expiryMMYY(a.billing.expires)}` : ""}
                          </p>
                          {bd.nextCharge && (
                            <p className="mt-1 text-xs text-kv-muted">
                              Next charge {fmtDate(bd.nextCharge.toISOString())} · about {money(bd.withTax)}
                            </p>
                          )}
                        </>
                      )}
                      {!a.billing?.autopay && <p className="mt-1 text-xs text-kv-muted">Contact us to set it up or change your payment card.</p>}
                    </div>
                    <div className="rounded-xl bg-kv-navy-50 p-4">
                      <dt className="text-xs font-semibold text-kv-muted">Lease</dt>
                      <dd className="mt-1">
                        <a href={`/api/portal/lease?location=${a.locationKey}&ledger=${l.ledgerId}`} className="font-bold text-kv-red underline">
                          View and sign my lease
                        </a>
                      </dd>
                    </div>
                  </dl>

                  {a.noke && (
                    <p className="mt-4 rounded-xl border border-kv-yellow bg-kv-yellow-light p-3 text-sm text-kv-navy">
                      Use the Nokē app to unlock your unit at {getLocation(a.locationKey).shortName}.
                      {env.appTestMode && " Sample note: Nokē is not activated in the simulator."}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {env.PAYMENT_MODE === "passthrough" && l.balance > 0 && (
                      <PortalPayForm locationKey={a.locationKey} ledgerId={l.ledgerId} amount={money(l.balance)} />
                    )}
                    {env.PAYMENT_MODE !== "passthrough" && env.PAY_ONLINE_URL && (
                      <a href={env.PAY_ONLINE_URL} className="btn-primary btn-sm min-h-11" target="_blank" rel="noopener noreferrer">
                        Make a payment
                      </a>
                    )}
                    {!canPayOnline && <p className="text-sm text-kv-muted">Your payment link isn&apos;t available. Call {BRAND.phone} to make a payment.</p>}
                    <a href={`tel:${BRAND.phoneE164}`} className="btn-ghost btn-sm min-h-11">
                      Call {BRAND.phone}
                    </a>
                  </div>

                  <details className="mt-5 rounded-xl border border-kv-line p-4">
                    <summary className="cursor-pointer font-semibold text-kv-navy">
                      {l.scheduledMoveOut ? `Move-out requested: ${fmtDate(l.scheduledMoveOut)}` : "Request move-out"}
                    </summary>
                    <div className="mt-3 max-w-sm space-y-3">
                      <p className="text-sm text-kv-muted">
                        Choose your planned date. Follow your rental agreement. Empty the unit and remove any personal lock by that date. We process the move-out to close your rental.
                        {l.balance > 0 && ` Outstanding balance of ${money(l.balance)} remains due.`}
                      </p>
                      <ActionForm action={scheduleMoveOutAction} submitLabel={l.scheduledMoveOut ? "Change move-out date" : "Send move-out date"} buttonClassName="btn-navy w-full">
                        <input type="hidden" name="locationKey" value={a.locationKey} />
                        <input type="hidden" name="ledgerId" value={l.ledgerId} />
                        <label className="block">
                          <span className="label">Planned move-out date</span>
                          <input type="date" name="date" min={today} required className="input" defaultValue={l.scheduledMoveOut?.slice(0, 10)} />
                        </label>
                      </ActionForm>
                      {l.scheduledMoveOut && (
                        <ActionForm action={cancelMoveOutAction} submitLabel="Cancel move-out request" buttonClassName="btn-ghost w-full" hideOnSuccess={false}>
                          <input type="hidden" name="locationKey" value={a.locationKey} />
                          <input type="hidden" name="ledgerId" value={l.ledgerId} />
                        </ActionForm>
                      )}
                    </div>
                  </details>
                </article>
              );
            })}
            {!a.ledgers.length && !a.error && <p className="text-sm text-kv-muted">No rental is linked to this account. Call {BRAND.phone} so we can check it.</p>}
          </div>
        </section>
      ))}

      <section className="card mt-10 p-6">
        <h2 className="text-lg font-extrabold text-kv-navy">Payment history</h2>
        {!history.length ? (
          <p className="mt-3 text-sm text-kv-muted">No payments recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-kv-line text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold text-kv-navy">{h.description}</p>
                  <p className="text-xs text-kv-muted">
                    {h.createdAt.toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Halifax" })}
                    {h.periodLabel ? ` · ${h.periodLabel}` : ""}
                    {h.paymentRef ? ` · Ref ${h.paymentRef}` : ""}
                  </p>
                </div>
                <p className="font-bold tabular-nums text-kv-navy">{money(h.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="card p-6" id="maintenance">
          <h2 className="text-lg font-extrabold text-kv-navy">Report a problem</h2>
          <p className="mt-1 text-sm text-kv-muted">Tell us what&apos;s wrong and where it is. Add photos if you can. For an urgent problem, also call {BRAND.phone}.</p>
          <div className="mt-4">
            <ActionForm action={maintenanceAction} submitLabel="Send report">
              <UnitPicker units={units} />
              <input type="hidden" name="name" value={first ? `${first.firstName} ${first.lastName}` : session.email} />
              <input type="hidden" name="phone" value={first?.phone ?? ""} />
              <label className="block">
                <span className="label">Problem type</span>
                <select name="issueType" required className="input">
                  {ISSUE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">What happened?</span>
                <textarea name="description" required minLength={5} rows={4} className="input py-3" />
              </label>
              <label className="block">
                <span className="label">Photos (optional)</span>
                <input name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" />
              </label>
              <ContactPref />
            </ActionForm>
          </div>
        </section>

        <section className="card p-6" id="transfer">
          <h2 className="text-lg font-extrabold text-kv-navy">Request a unit change</h2>
          <p className="mt-1 text-sm text-kv-muted">Need a different size or location? Tell us what you&apos;re looking for. We&apos;ll check availability and contact you. Your rental stays the same until we confirm the change.</p>
          <div className="mt-4">
            <ActionForm action={transferAction} submitLabel="Send request">
              <UnitPicker units={units} field="currentUnitName" />
              <label className="block">
                <span className="label">Type of change</span>
                <select name="direction" className="input">
                  <option value="bigger">Bigger unit</option>
                  <option value="smaller">Smaller unit</option>
                  <option value="different_type">Different location</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Preferred location</span>
                <select name="desiredLocation" className="input">
                  <option value="same">Same location</option>
                  {LOCATIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.shortName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Size needed</span>
                  <input name="desiredSize" placeholder="e.g. 10x15" className="input" />
                </label>
                <div className="space-y-3 sm:col-span-1">
                  <TimingFields />
                </div>
              </div>
              <label className="block">
                <span className="label">Anything else we should know?</span>
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
  return <UnitSelect units={units} field={field} />;
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
      <span className="label">How should we contact you?</span>
      <select name="contactPref" className="input">
        <option value="phone">Phone</option>
        <option value="text">Text</option>
        <option value="email">Email</option>
        <option value="no_contact">No follow-up needed</option>
      </select>
    </label>
  );
}
