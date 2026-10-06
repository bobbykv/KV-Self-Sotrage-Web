import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CostBreakdown } from "@/components/CostBreakdown";
import { HoldCountdown } from "@/components/HoldCountdown";
import { PromoBanner } from "@/components/PromoBanner";
import { BRAND, getLocation, isLocationKey } from "@/config/locations";
import { formatSize, money } from "@/lib/catalog";
import { getLivePromotions } from "@/lib/cms";
import { env } from "@/lib/env";
import { getHold, HOLD_COOKIE, retryCost } from "@/lib/holds";
import { getSettings } from "@/lib/settings";
import type { MoveInCost } from "@/lib/sitelink/types";
import { cancelHold } from "./actions";
import { CardPaymentForm, PaySeparatelyPanel } from "./PaymentPanels";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const owner = (await cookies()).get(HOLD_COOKIE)?.value === holdId;
  let hold = owner ? await getHold(holdId) : null;

  if (!hold || !isLocationKey(hold.locationKey)) {
    return (
      <div className="container-kv max-w-xl py-16 text-center">
        <h1 className="h2">We couldn&apos;t find that checkout</h1>
        <p className="mt-3 text-kv-muted">Checkouts only open on the device where they were started. If you need help, call {BRAND.phone}.</p>
        <Link href="/units" className="btn-primary mt-6">
          See available units
        </Link>
      </div>
    );
  }
  if (["confirmed_pay_separately", "moved_in"].includes(hold.status)) redirect(`/checkout/${holdId}/confirmation`);

  if (hold.status !== "active") {
    const failed = hold.status === "payment_failed";
    return (
      <div className="container-kv max-w-xl py-16 text-center">
        <h1 className="h2">{failed ? "We couldn't complete your payment" : "This hold has ended"}</h1>
        <p className="mt-3 text-kv-muted">
          {failed
            ? `We couldn't confirm your payment. Please call ${BRAND.phone} before trying again so we can check it and help you finish.`
            : "Your checkout time has ended. Browse the available spaces to start again."}
        </p>
        <Link href={`/units?location=${hold.locationKey}`} className="btn-primary mt-6">
          Back to units
        </Link>
      </div>
    );
  }

  const locationKey = hold.locationKey;
  hold = await retryCost(hold);
  const [settings, promos] = await Promise.all([getSettings(), getLivePromotions({ placement: "checkout", location: locationKey })]);
  const loc = getLocation(locationKey);
  const cost = hold.costBreakdown as unknown as MoveInCost | null;

  return (
    <div className="container-kv max-w-5xl py-6 sm:py-10">
      <HoldCountdown holdId={hold.id} expiresAt={hold.expiresAt.toISOString()} location={hold.locationKey} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="card p-6">
          <p className="eyebrow">Your unit</p>
          <h1 className="mt-1 text-2xl font-extrabold text-kv-navy">
            {formatSize(hold.widthFt, hold.lengthFt)} {hold.unitTypeName}
          </h1>
          <p className="text-sm text-kv-muted">
            {loc.name} · Unit {hold.unitName}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-kv-muted">Move-in date</dt>
              <dd className="font-semibold">{hold.moveInDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</dd>
            </div>
            <div>
              <dt className="text-kv-muted">Monthly rent</dt>
              <dd className="font-semibold">{money(Number(hold.quotedRate))} + HST</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-kv-muted">Name</dt>
              <dd className="font-semibold">
                {hold.firstName} {hold.lastName} · {hold.email} · {hold.phone}
              </dd>
            </div>
          </dl>

          <h2 className="mt-8 font-extrabold text-kv-navy">What you&apos;ll pay at move-in</h2>
          <div className="mt-3">
            {cost ? (
              <CostBreakdown cost={cost} hstRate={env.HST_RATE} />
            ) : (
              <p className="rounded-xl bg-kv-yellow-light p-4 text-sm">
                Your full move-in total isn&apos;t available yet. Refresh in a moment, or contact us for help. You can continue once the total, including HST, is shown.
              </p>
            )}
          </div>
          {promos.length > 0 && (
            <div className="mt-6">
              <PromoBanner promos={promos} compact />
              <p className="mt-2 text-xs text-kv-muted">Mention the promo to our office and we&apos;ll apply it to your account if it fits your rental.</p>
            </div>
          )}
        </section>

        <aside className="card self-start p-6">
          <h2 className="font-extrabold text-kv-navy">{env.PAYMENT_MODE === "passthrough" ? "Complete your rental" : "Confirm your reservation"}</h2>
          <div className="mt-4">
            {!cost ? (
              <p className="text-sm text-kv-muted">Waiting for your total…</p>
            ) : env.PAYMENT_MODE === "passthrough" ? (
              <CardPaymentForm holdId={hold.id} total={money(cost.total)} />
            ) : (
              <PaySeparatelyPanel holdId={hold.id} hours={settings.confirmedReservationHours} payOnlineUrl={env.PAY_ONLINE_URL} />
            )}
          </div>
          <form action={cancelHold.bind(null, hold.id)} className="mt-4 text-center">
            <button className="text-sm font-semibold text-kv-muted underline hover:text-kv-red">Cancel this checkout</button>
          </form>
          <p className="mt-4 text-xs text-kv-muted">
            Questions about the total or a change of plans? Call {BRAND.phone} and we&apos;ll help you work through it.
          </p>
        </aside>
      </div>
    </div>
  );
}
