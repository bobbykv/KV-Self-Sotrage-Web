import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { expireHolds, HOLD_COOKIE } from "@/lib/holds";

/** Called by the checkout countdown at 0:00. Expiry is time-based, so this only sweeps lapsed holds. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if ((await cookies()).get(HOLD_COOKIE)?.value !== id) return NextResponse.json({ ok: false }, { status: 403 });
  await expireHolds();
  return NextResponse.json({ ok: true });
}
