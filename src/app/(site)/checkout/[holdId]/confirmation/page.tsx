import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { MoveInSteps } from "@/components/MoveInSteps";
import { BRAND, fullAddress, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { isMultiPeriodPrepaid, recurringBillingNote } from "@/lib/sitelink/concessions";
import { env } from "@/lib/env";
import { getHold, HOLD_COOKIE } from "@/lib/holds";
import { sitelink } from "@/lib/sitelink/client";
import type { MoveInCost } from "@/lib/sitelink/types";
import { PortalPasswordForm } from "./PortalPasswordForm";

export const metadata: Metadata = { title: "Confirmation", robots: { index: false } };

export default async function Confirmation({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const owner = (await cookies()).get(HOLD_COOKIE)?.value === holdId;
  const hold = owner ? await getHold(holdId) : null;
  if (!hold || !isLocationKey(hold.locationKey) || !["confirmed_pay_separately", "moved_in"].includes(hold.status)) {
    return (
      <div className="container-kv max-w-xl py-16 text-center">
        <h1 className="h2">We couldn&apos;t find this hold</h1>
        <p className="mt-3 text-kv-muted">Choose an available unit to start again. Call {BRAND.phone} if you need help.</p>
        <Link href="/units" className="btn-primary mt-6">
          See available units
        </Link>
      </div>
    );
  }
  const loc = getLocation(hold.locationKey);
  const movedIn = hold.status === "moved_in";
  const cost = hold.costBreakdown as unknown as MoveInCost | null;
  const prepaid = Boolean(hold.concessionId) && isMultiPeriodPrepaid(cost?.startDate, cost?.endDate);
  const recurringNote = recurringBillingNote(prepaid);
  const leaseUrl =
    movedIn && hold.tenantId && hold.ledgerId ? await sitelink.leaseUrl(hold.locationKey, hold.tenantId, hold.ledgerId, `${env.APP_URL}/portal`).catch(() => null) : null;
  const unitSize = formatSize(hold.widthFt, hold.lengthFt);
  const expiry = hold.expiresAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Halifax" });
  const moveInDate = hold.moveInDate.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="container-kv max-w-3xl py-10 sm:py-16">
      <h1 className="h1">
        {movedIn ? `Your storage rental at ${loc.shortName} is confirmed` : `Your storage reservation at ${loc.shortName} is confirmed`}
      </h1>
      <p className="mt-3 text-kv-muted">
        {movedIn
          ? `Payment received: ${cost ? money(cost.total) : "confirmed"}. Your unit is ${unitSize}. Your move-in date is ${moveInDate}.`
          : `We've reserved ${unitSize} for you until ${expiry}. Finish payment and your rental before you move in.`}
      </p>

      <section className="card mt-8 p-6">
        <h2 className="font-extrabold text-kv-navy">Your rental details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-kv-muted">Location</dt>
            <dd className="font-semibold">{loc.name}</dd>
          </div>
          <div>
            <dt className="text-kv-muted">Address</dt>
            <dd className="font-semibold">{fullAddress(loc)}</dd>
          </div>
          <div>
            <dt className="text-kv-muted">Unit</dt>
            <dd className="font-semibold">
              {unitSize} {hold.unitTypeName} · Unit {hold.unitName}
            </dd>
          </div>
          <div>
            <dt className="text-kv-muted">Move-in date</dt>
            <dd className="font-semibold">{moveInDate}</dd>
          </div>
          <div>
            <dt className="text-kv-muted">{prepaid ? "Prepaid package" : "28-day rent"}</dt>
            <dd className="font-semibold">{prepaid ? "6 billing periods" : `${money(Number(hold.quotedRate))} + HST`}</dd>
          </div>
          {!movedIn && (
            <div>
              <dt className="text-kv-muted">Reservation number</dt>
              <dd className="font-mono font-semibold">{hold.id.slice(0, 8).toUpperCase()}</dd>
            </div>
          )}
          {movedIn && cost && (
            <div>
              <dt className="text-kv-muted">Payment received</dt>
              <dd className="font-semibold">{money(cost.total)}</dd>
            </div>
          )}
          {movedIn && hold.paymentRef && (
            <div>
              <dt className="text-kv-muted">Receipt reference</dt>
              <dd className="font-mono font-semibold">{hold.paymentRef}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 rounded-xl bg-kv-navy-50 p-4 text-sm font-semibold text-kv-navy">
          {movedIn && hold.autoBillEnabled
            ? recurringNote.replace("will be saved", "is saved in SiteLink")
            : movedIn
              ? "Your first payment is complete. Call us if automatic 28-day billing is not on this card yet."
              : recurringNote}
        </p>
      </section>

      <div className="mt-8">
        <MoveInSteps current={movedIn ? 2 : 1} />
      </div>

      {movedIn ? (
        <section className="card mt-4 border-2 border-kv-navy p-6 sm:p-8">
          <p className="text-sm font-extrabold uppercase tracking-wide text-kv-red">Step 1 after payment</p>
          <h2 className="mt-1 text-2xl font-extrabold text-kv-navy">Sign your SiteLink lease</h2>
          <p className="mt-2 text-kv-muted">
            Your lease is ready now. Sign it here. The same link is emailed to you so you can finish it on your phone. Unit access comes after the lease.
          </p>
          {leaseUrl ? (
            <a href={leaseUrl} className="btn-primary mt-5 inline-flex px-8 py-4 text-lg">
              View and sign my lease
            </a>
          ) : (
            <p className="mt-5 rounded-xl bg-kv-yellow-light p-4 text-sm text-kv-navy">
              Your lease link is on its way by email. If it doesn&apos;t arrive in a few minutes, call {BRAND.phone} and we&apos;ll send it again.
            </p>
          )}
        </section>
      ) : (
        <section className="card mt-4 p-6">
          <h2 className="font-extrabold text-kv-navy">Finish payment, then sign your lease</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li>
              {env.PAY_ONLINE_URL
                ? `Pay using the link below, or call ${BRAND.phone} during office hours.`
                : `Pay by calling ${BRAND.phone} or visiting the office during office hours.`}
            </li>
            <li>Sign your SiteLink lease from the link we email after payment.</li>
            <li>Get unit access: a Nokē Smart Entry invite for Addington Forks and Stellarton, or a gate and door code for Haley Road.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            {env.PAY_ONLINE_URL && (
              <a href={env.PAY_ONLINE_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
                Continue to payment
              </a>
            )}
            <a href={`tel:${BRAND.phoneE164}`} className="btn-ghost">
              Call {BRAND.phone}
            </a>
          </div>
        </section>
      )}

      <section className="card mt-4 p-6">
        <p className="text-xs font-extrabold uppercase tracking-wide text-kv-muted">Step 3</p>
        <h2 className="mt-1 font-extrabold text-kv-navy">Get unit access</h2>
        {loc.amenities.nokeRemoteUnlock ? (
          <p className="mt-3 text-sm text-kv-muted">
            {loc.shortName} uses Nokē Smart Entry. After your lease is signed, an app invite is texted and emailed to you so you can unlock your unit. Missing the invitation? Call {BRAND.phone}.
          </p>
        ) : (
          <p className="mt-3 text-sm text-kv-muted">
            Haley Road uses a gate and door code. You receive the code with your rental. Call {BRAND.phone} if you need help getting in.
          </p>
        )}
        {(env.appTestMode || env.sitelinkMode === "mock") && (
          <p className="mt-4 rounded-xl border border-kv-line bg-kv-navy-50 p-3 text-sm text-kv-navy">
            Simulator: access codes shown in the portal are sample data only. Nokē is not activated here.
          </p>
        )}
        {movedIn && (
          <Link href="/portal" className="btn-ghost mt-5 inline-flex">
            My storage
          </Link>
        )}
      </section>

      {movedIn && hold.tenantCreated && !hold.portalPasswordSet && (
        <section className="card mt-4 p-6">
          <h2 className="font-extrabold text-kv-navy">Set up your storage account</h2>
          <p className="mt-1 text-sm text-kv-muted">Choose a password to view your rental details and send requests.</p>
          <div className="mt-4 max-w-sm">
            <PortalPasswordForm holdId={hold.id} email={hold.email} />
          </div>
        </section>
      )}
    </div>
  );
}
