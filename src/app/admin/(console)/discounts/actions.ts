"use server";

import { revalidatePath } from "next/cache";
import { isLocationKey } from "@/config/locations";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { setDiscountToggle } from "@/lib/discount-visibility";

export async function setDiscountVisibleAction(locationKey: string, concessionId: number, enabled: boolean) {
  const admin = await requireAdmin();
  if (!isLocationKey(locationKey) || !Number.isInteger(concessionId) || concessionId <= 0) return;
  await setDiscountToggle(locationKey, concessionId, enabled);
  await audit(admin.email, "discount.toggle", `${locationKey}:${concessionId}`, { enabled });
  revalidatePath("/admin/discounts");
  revalidatePath("/checkout/[holdId]", "page");
}
