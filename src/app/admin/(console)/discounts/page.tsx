import { PageHeader } from "@/components/admin/LocationSwitcher";
import { getLocation, LOCATION_KEYS, type LocationKey } from "@/config/locations";
import { money } from "@/lib/catalog";
import { isWinterPrepaidPlan, matchingWinterPrepaidPlan } from "@/lib/sitelink/concessions";
import { sitelink } from "@/lib/sitelink/client";
import type { ConcessionPlan } from "@/lib/sitelink/types";

export const metadata = { title: "Discount plans" };
export const dynamic = "force-dynamic";

const AMOUNT = ["Amount off", "Percent off", "Fixed rate"];

function amountLabel(plan: ConcessionPlan): string {
  if (plan.amountType === 2) return `${AMOUNT[2]} ${plan.chargeAmount ? money(plan.chargeAmount) : ""}`.trim();
  if (plan.amountType === 1) return `${plan.percentDiscount}% off`;
  if (plan.amountType === 0 && plan.fixedDiscount) return `${money(plan.fixedDiscount)} off`;
  return AMOUNT[plan.amountType] ?? `Type ${plan.amountType}`;
}

function restrictions(plan: ConcessionPlan): string {
  if (plan.forAllUnits || plan.unitTypes.length === 0) return "All unit types";
  return plan.unitTypes
    .map((t) => t.typeName || (t.widthFt && t.lengthFt ? `${t.widthFt}×${t.lengthFt}` : t.unitTypeId ? `Type ${t.unitTypeId}` : "Restricted"))
    .join(", ");
}

export default async function AdminDiscounts() {
  const reports = await Promise.all(
    LOCATION_KEYS.map(async (key) => ({ key, report: await sitelink.discountPlans(key) })),
  );
  const winter = reports
    .map(({ key, report }) => ({ key, plan: matchingWinterPrepaidPlan(report.plans) }))
    .filter((row): row is { key: LocationKey; plan: ConcessionPlan } => Boolean(row.plan));

  return (
    <>
      <PageHeader title="SiteLink discount plans" />
      <p className="mt-4 max-w-3xl text-sm text-kv-muted">
        These are the concession plans SiteLink returned from DiscountPlansRetrieve. Checkout uses a plan&apos;s ConcessionID only when it is in this list and applies to the unit. The $399 6-month winter outdoor package is attached automatically when a matching prepaid plan exists at Exit 31.
      </p>
      {winter.length > 0 ? (
        <div className="mt-4 rounded-xl bg-kv-navy-50 p-4 text-sm text-kv-navy">
          <p className="font-extrabold">Winter 6-month package found</p>
          <ul className="mt-2 space-y-1">
            {winter.map(({ key, plan }) => (
              <li key={`${key}-${plan.concessionId}`}>
                {getLocation(key).shortName}: ConcessionID {plan.concessionId} · {plan.name}
                {plan.prepay ? ` · prepaid ${plan.prepaidMonths} periods` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-kv-yellow-light p-4 text-sm text-kv-navy">
          <p className="font-extrabold">No matching $399 / 6-month winter plan yet</p>
          <p className="mt-1">
            Checkout keeps working on standard 28-day billing. When Naiya adds the Exit 31 winter prepaid plan in SiteLink, its ConcessionID will show up here and on eligible outdoor units.
          </p>
        </div>
      )}
      <div className="mt-6 space-y-8">
        {reports.map(({ key, report }) => (
          <section key={key}>
            <h2 className="font-extrabold text-kv-navy">{getLocation(key).name}</h2>
            {report.source === "unavailable" && (
              <p className="mt-2 rounded-xl bg-kv-red-50 p-3 text-sm text-kv-red">DiscountPlansRetrieve failed: {report.error}</p>
            )}
            {report.plans.length === 0 ? (
              <p className="mt-2 text-sm text-kv-muted">No discount plans returned for this site.</p>
            ) : (
              <div className="card mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-kv-navy-50 text-left text-xs text-kv-muted">
                    <tr>
                      <th className="p-3">ConcessionID</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Prepay</th>
                      <th className="p-3">Units</th>
                      <th className="p-3">Checkout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.plans.map((plan) => (
                      <tr key={plan.concessionId} className="border-t border-kv-line">
                        <td className="p-3 font-mono font-semibold">{plan.concessionId}</td>
                        <td className="p-3">
                          <p className="font-semibold">{plan.name}</p>
                          {plan.description && <p className="text-xs text-kv-muted">{plan.description}</p>}
                        </td>
                        <td className="p-3">{amountLabel(plan)}</td>
                        <td className="p-3">{plan.prepay ? `${plan.prepaidMonths} periods` : "No"}</td>
                        <td className="p-3 text-xs">{restrictions(plan)}</td>
                        <td className="p-3 text-xs">
                          {plan.disabled ? "Disabled" : plan.showOn === 2 ? "Payments only" : isWinterPrepaidPlan(plan) ? "Winter package match" : "Available"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
