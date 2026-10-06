import { PageHeader } from "@/components/admin/LocationSwitcher";
import { PromoForm } from "../PromoForm";

export const metadata = { title: "New promotion" };

export default function NewPromotion() {
  return (
    <>
      <PageHeader title="New promotion" />
      <PromoForm />
    </>
  );
}
