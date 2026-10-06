"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { confirmPaySeparately, getHold, HOLD_COOKIE, HoldError, releaseHold } from "@/lib/holds";

async function assertOwner(holdId: string) {
  if ((await cookies()).get(HOLD_COOKIE)?.value !== holdId) throw new HoldError("cookie mismatch", "Open checkout in the browser where you started your hold. Call (902) 867-3779 if you need help.");
}

export async function confirmReservation(holdId: string): Promise<{ error?: string }> {
  try {
    await assertOwner(holdId);
    await confirmPaySeparately(holdId);
  } catch (err) {
    return { error: err instanceof HoldError ? err.userMessage : "We couldn't confirm your reservation. Try again or call (902) 867-3779." };
  }
  redirect(`/checkout/${holdId}/confirmation`);
}

export async function cancelHold(holdId: string) {
  await assertOwner(holdId);
  const hold = await getHold(holdId);
  await releaseHold(holdId);
  redirect(`/units${hold ? `?location=${hold.locationKey}` : ""}`);
}
