"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { confirmPaySeparately, getHold, HOLD_COOKIE, HoldError, releaseHold } from "@/lib/holds";

async function assertOwner(holdId: string) {
  if ((await cookies()).get(HOLD_COOKIE)?.value !== holdId) throw new HoldError("cookie mismatch", "Please open this checkout on the device where you started it.");
}

export async function confirmReservation(holdId: string): Promise<{ error?: string }> {
  try {
    await assertOwner(holdId);
    await confirmPaySeparately(holdId);
  } catch (err) {
    return { error: err instanceof HoldError ? err.userMessage : "Something went wrong. Please call (902) 867-3779." };
  }
  redirect(`/checkout/${holdId}/confirmation`);
}

export async function cancelHold(holdId: string) {
  await assertOwner(holdId);
  const hold = await getHold(holdId);
  await releaseHold(holdId);
  redirect(`/units${hold ? `?location=${hold.locationKey}` : ""}`);
}
