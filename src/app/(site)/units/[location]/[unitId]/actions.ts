"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocationKey } from "@/config/locations";
import { env } from "@/lib/env";
import { createHold, HOLD_COOKIE, HoldError } from "@/lib/holds";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  location: z.string(),
  unitId: z.coerce.number().int().positive(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type HoldFormState = { error?: string };

export async function startHold(_prev: HoldFormState, form: FormData): Promise<HoldFormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success || !isLocationKey(parsed.data.location)) return { error: "Please fill in your name, email, phone and move-in date." };
  const d = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`hold:${ip}`, 6, 1800)) || !(await rateLimit(`hold-email:${d.email.toLowerCase()}`, 4, 1800))) {
    return { error: "You've started several holds in a short time. Please call (902) 867-3779 and we'll help you directly." };
  }
  const moveIn = new Date(`${d.moveInDate}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today.getTime() + 30 * 86_400_000);
  if (moveIn < today || moveIn > max) return { error: "Please choose a move-in date within the next 30 days." };

  let holdId: string;
  try {
    const hold = await createHold({
      locationKey: d.location as "haley" | "hwy4" | "stellarton",
      unitId: d.unitId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      moveInDate: moveIn,
    });
    holdId = hold.id;
  } catch (err) {
    if (err instanceof HoldError) {
      if (/taken|rented/.test(err.userMessage)) redirect(`/units?location=${d.location}&notice=${encodeURIComponent(err.userMessage)}`);
      return { error: err.userMessage };
    }
    log.error("startHold failed", { err });
    return { error: "Something went wrong placing your hold. Please try again or call (902) 867-3779." };
  }
  (await cookies()).set(HOLD_COOKIE, holdId, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: 60 * 60 * 72 });
  redirect(`/checkout/${holdId}`);
}
