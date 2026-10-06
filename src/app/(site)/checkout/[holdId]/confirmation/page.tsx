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
        <h1 className="h2">Let&apos;s check your booking</h1>
        <p className="mt-3 text-kv-muted">If you just arranged a rental, call {BRAND.phone} and we&apos;ll help you confirm your next step.</p>
      </div>
    );
  }
  const loc = getLocation(hold.locationKey);
  const movedIn = hold.status === "moved_in";
  const cost = hold.costBreakdown as unknown as MoveInCost | null;
  const leaseUrl =
    movedIn && hold.tenantId && hold.ledgerId ? await sitelink.leaseUrl(hold.locationKey, hold.tenantId, hold.ledgerId, `${env.APP_URL}/portal`).catch(() => null) : null;

  return (
    <div className="container-kv max-w-3xl py-10 sm:py-16">
      <p className="eyebrow">{movedIn ? "Rental confirmed" : "Reservation confirmed"}</p>
      <h1 className="h1 mt-2">{movedIn ? `Your next step is getting settled, ${hold.firstName}` : `Your space is reserved, ${hold.firstName}`}</h1>

      <section className="card mt-8 p-6">
        <h2 className="font-extrabold text-kv-navy">
          {formatSize(hold.widthFt, hold.lengthFt)} {hold.unitTypeName} · Unit {hold.unitName}
        </h2>
        <p className="text-sm text-kv-muted">
          {loc.name} · {fullAddress(loc)}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-kv-muted">Move-in date</dt>
            <dd className="font-semibold">{hold.moveInDate.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</dd>
          </div>
          {cost && (
            <div>
              <dt className="text-kv-muted">{movedIn ? "Paid today (incl. HST)" : "Due at move-in (incl. HST)"}</dt>
              <dd className="font-semibold">{money(cost.total)}</dd>
            </div>
          )}
          {movedIn && hold.paymentRef && (
            <div>
              <dt className="text-kv-muted">Receipt reference</dt>
              <dd className="font-mono font-semibold">{hold.paymentRef}</dd>
            </div>
          )}
          {!movedIn && (
            <div>
              <dt className="text-kv-muted">Held until</dt>
              <dd className="font-semibold">{hold.expiresAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Halifax" })}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-extrabold text-kv-navy">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {movedIn ? (
            <>
              <li>{leaseUrl ? "Sign your lease online (button below)." : "Our office will send your lease to sign."}</li>
              <li>Check your storage account for your access details. If they are missing, contact us before heading over so we can help you get in.</li>
              {loc.amenities.nokeRemoteUnlock && <li>Follow your Nokē app-access instructions for this location. If you need help with setup or have not received instructions, contact us.</li>}
              <li>Bring photo ID and follow your access instructions on move-in day. Once your access is ready, you can visit your belongings 24/7.</li>
            </>
          ) : (
            <>
              <li>We&apos;ll contact you during office hours {loc.officeHours[0] ? `(${loc.officeHours[0].days})` : ""} to help you finish payment and your rental before your reservation expires.</li>
              {env.PAY_ONLINE_URL && (
                <li>
                  Prefer to pay now? Use our{" "}
                  <a href={env.PAY_ONLINE_URL} className="font-semibold text-kv-red underline" target="_blank" rel="noopener noreferrer">
                    secure online payment page
                  </a>
                  .
                </li>
              )}
              <li>Access is arranged after your rental is complete. Your reservation alone does not give you access.</li>
              {loc.amenities.nokeRemoteUnlock && <li>You&apos;ll use the Nokē app at this location. Follow the setup instructions provided when your rental is complete.</li>}
            </>
          )}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          {leaseUrl && (
            <a href={leaseUrl} className="btn-primary">
              Sign my lease
            </a>
          )}
          <a href={`tel:${BRAND.phoneE164}`} className="btn-ghost">
            Call {BRAND.phone}
          </a>
        </div>
      </section>

      {movedIn && hold.tenantCreated && !hold.portalPasswordSet && (
        <section className="card mt-4 p-6">
          <h2 className="font-extrabold text-kv-navy">Keep your storage details handy</h2>
          <p className="mt-1 text-sm text-kv-muted">Create your account password to check your balance and access details, report a problem, or let us know when your plans change.</p>
          <div className="mt-4 max-w-sm">
            <PortalPasswordForm holdId={hold.id} email={hold.email} />
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-kv-muted">
        Plans changed or unsure what to do next? Contact us for help. <Link href="/faq" className="font-semibold underline">Get answers</Link>
      </p>
    </div>
  );
}
