"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getHold, HOLD_COOKIE, HoldError, releaseHold } from "@/lib/holds";

async function assertOwner(holdId: string) {
  if ((await cookies()).get(HOLD_COOKIE)?.value !== holdId) throw new HoldError("cookie mismatch", "Open checkout in the browser where you started your hold. Call (902) 867-3779 if you need help.");
}

export async function cancelHold(holdId: string) {
  await assertOwner(holdId);
  const hold = await getHold(holdId);
  await releaseHold(holdId);
  redirect(`/units${hold ? `?location=${hold.locationKey}` : ""}`);
}
