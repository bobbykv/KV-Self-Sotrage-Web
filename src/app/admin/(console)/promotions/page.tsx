import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/admin/LocationSwitcher";
import { getLocation, isLocationKey } from "@/config/locations";
import { db } from "@/lib/db";
import { promoStatus } from "@/lib/promotions";
import { deletePromoAction, setPromoActiveAction } from "../actions";

export const metadata = { title: "Promotions" };

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium" }) : null);

export default async function AdminPromotions() {
  const promos = await db.promotion.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Promotions">
        <Link href="/admin/promotions/new" className="btn-primary btn-sm">
          New promotion
        </Link>
      </PageHeader>
      {!promos.length && <p className="text-sm text-kv-muted">No promotions yet.</p>}
      <div className="grid gap-3">
        {promos.map((p) => {
          const status = promoStatus(p);
          const where = p.locations.includes("all") ? "All locations" : p.locations.map((l) => (isLocationKey(l) ? getLocation(l).shortName : l)).join(", ");
          const window = [fmt(p.startsAt) ?? "now", fmt(p.endsAt) ?? "no end date"].join(" → ");
          return (
            <article key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold text-kv-navy">
                  {p.headline} <StatusBadge status={status} />
                </p>
                <p className="text-sm text-kv-muted">
                  {where} · {p.placements.join(", ")} · {window}
                  {p.code && ` · code ${p.code}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/promotions/${p.id}`} className="btn-ghost btn-sm">
                  Edit
                </Link>
                <form action={setPromoActiveAction.bind(null, p.id, !p.active)}>
                  <button className="btn-navy btn-sm">{p.active ? "Deactivate" : "Activate"}</button>
                </form>
                <form action={deletePromoAction.bind(null, p.id)}>
                  <button className="btn-ghost btn-sm text-kv-red">Delete</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
