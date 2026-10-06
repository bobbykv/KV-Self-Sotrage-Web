import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BRAND, fullAddress, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
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
            <dt className="text-kv-muted">Monthly rent</dt>
            <dd className="font-semibold">{money(Number(hold.quotedRate))} + HST</dd>
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
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-extrabold text-kv-navy">{movedIn ? "Before you move in" : "What to do next"}</h2>
        {movedIn ? (
          <p className="mt-3 text-sm text-kv-muted">
            Complete your lease using the link below, if shown. Follow the access instructions for your location. If anything is missing, call {BRAND.phone}.
          </p>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {env.PAY_ONLINE_URL && (
              <li>
                Finish payment using the link below. You can also call {BRAND.phone} or visit the office during office hours.
              </li>
            )}
            {!env.PAY_ONLINE_URL && (
              <li>
                Finish payment by calling {BRAND.phone} or visiting the office during office hours.
              </li>
            )}
            <li>Complete your rental and lease.</li>
            <li>Follow your access instructions. Call us if you haven&apos;t received them.</li>
          </ol>
        )}
        {loc.amenities.nokeRemoteUnlock && !env.appTestMode && env.sitelinkMode !== "mock" && (
          <p className="mt-4 rounded-xl border border-kv-yellow bg-kv-yellow-light p-3 text-sm text-kv-navy">
            Addington Forks and Stellarton use the Nokē app to unlock your unit. Follow the setup instructions you receive after completing your rental. Missing the
            invitation? Call {BRAND.phone}.
          </p>
        )}
        {(env.appTestMode || env.sitelinkMode === "mock") && (
          <p className="mt-4 rounded-xl border border-kv-line bg-kv-navy-50 p-3 text-sm text-kv-navy">
            Simulator: access codes shown in the portal are sample data only. Nokē is not activated here.
          </p>
        )}
        {!loc.amenities.nokeRemoteUnlock && !env.appTestMode && env.sitelinkMode !== "mock" && (
          <p className="mt-4 text-sm text-kv-muted">
            Follow the gate and unit-access instructions provided with your rental. Call {BRAND.phone} if you need help getting in.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {movedIn && leaseUrl && (
            <a href={leaseUrl} className="btn-primary">
              View and sign my lease
            </a>
          )}
          {!movedIn && env.PAY_ONLINE_URL && (
            <a href={env.PAY_ONLINE_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
              Continue to payment
            </a>
          )}
          {movedIn ? (
            <Link href="/portal" className="btn-ghost">
              My storage
            </Link>
          ) : (
            <a href={`tel:${BRAND.phoneE164}`} className="btn-ghost">
              Call {BRAND.phone}
            </a>
          )}
        </div>
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
