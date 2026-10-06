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
        <h1 className="h2">{owner ? "We couldn't find this hold" : "Open checkout in the browser where you started your hold"}</h1>
        <p className="mt-3 text-kv-muted">
          {owner
            ? "Choose an available unit to start again."
            : `Call ${BRAND.phone} if you need help.`}
        </p>
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
        <h1 className="h2">{failed ? "We couldn't confirm your payment" : "Your unit hold has ended"}</h1>
        <p className="mt-3 text-kv-muted">
          {failed
            ? `We couldn't confirm your payment. Call ${BRAND.phone} before trying again so we can check it.`
            : "Check availability and start a new hold."}
        </p>
        <Link href={`/units?location=${hold.locationKey}`} className="btn-primary mt-6">
          See available units
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
      <h1 className="h2">Your storage unit at {loc.shortName}</h1>
      <p className="mt-2 text-kv-muted">Check your details and the full cost before you finish.</p>
      <div className="mt-4">
        <HoldCountdown holdId={hold.id} expiresAt={hold.expiresAt.toISOString()} location={hold.locationKey} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="card p-6">
          <h2 className="font-extrabold text-kv-navy">Your rental details</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-kv-muted">Location</dt>
              <dd className="font-semibold">{loc.name}</dd>
            </div>
            <div>
              <dt className="text-kv-muted">Unit</dt>
              <dd className="font-semibold">
                {formatSize(hold.widthFt, hold.lengthFt)} {hold.unitTypeName} · Unit {hold.unitName}
              </dd>
            </div>
            <div>
              <dt className="text-kv-muted">Move-in date</dt>
              <dd className="font-semibold">{hold.moveInDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</dd>
            </div>
            <div>
              <dt className="text-kv-muted">Monthly rent</dt>
              <dd className="font-semibold">{money(Number(hold.quotedRate))} + HST</dd>
            </div>
            <div>
              <dt className="text-kv-muted">Name</dt>
              <dd className="font-semibold">
                {hold.firstName} {hold.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-kv-muted">Email</dt>
              <dd className="font-semibold">{hold.email}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-kv-muted">Mobile number</dt>
              <dd className="font-semibold">{hold.phone}</dd>
            </div>
          </dl>

          <h2 className="mt-8 font-extrabold text-kv-navy">Your move-in total</h2>
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
          <h2 className="font-extrabold text-kv-navy">
            {env.PAYMENT_MODE === "passthrough" ? "Pay and finish your rental" : "Reserve now. Finish your rental next."}
          </h2>
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
            <button className="text-sm font-semibold text-kv-muted underline hover:text-kv-red">Cancel this hold</button>
          </form>
          <p className="mt-4 text-xs text-kv-muted">
            Questions about the total or a change of plans? Call {BRAND.phone} and we&apos;ll help you work through it.
          </p>
        </aside>
      </div>
    </div>
  );
}
