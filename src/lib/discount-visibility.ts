import "server-only";
import { db } from "./db";
import { discountToggleKey } from "./sitelink/concessions";

/** Staff On/Off rows. Missing keys keep the SiteLink default. */
export async function getDiscountToggles(): Promise<Record<string, boolean>> {
  const rows = await db.discountPlanToggle.findMany();
  const out: Record<string, boolean> = {};
  for (const row of rows) out[discountToggleKey(row.locationKey, row.concessionId)] = row.enabled;
  return out;
}

export async function setDiscountToggle(locationKey: string, concessionId: number, enabled: boolean) {
  await db.discountPlanToggle.upsert({
    where: { locationKey_concessionId: { locationKey, concessionId } },
    create: { locationKey, concessionId, enabled },
    update: { enabled },
  });
}
