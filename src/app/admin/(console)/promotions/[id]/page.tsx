import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/LocationSwitcher";
import { db } from "@/lib/db";
import { PromoForm } from "../PromoForm";

export const metadata = { title: "Edit promotion" };

export default async function EditPromotion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const promo = await db.promotion.findUnique({ where: { id } });
  if (!promo) notFound();
  return (
    <>
      <PageHeader title="Edit promotion" />
      <PromoForm promo={promo} />
    </>
  );
}
