import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookieNames, env } from "@/lib/env";

export const runtime = "nodejs";

/** Sets the checkout cookie from a staff link, then opens checkout on this phone. */
export async function GET(req: Request, { params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const token = new URL(req.url).searchParams.get("k");
  const destination = new URL(`/checkout/${holdId}`, env.APP_URL);
  const hold = await db.hold.findUnique({ where: { id: holdId } });
  const response = NextResponse.redirect(destination);
  if (hold && hold.status === "active" && hold.staffIssued && hold.claimToken && token === hold.claimToken && hold.expiresAt > new Date()) {
    response.cookies.set(cookieNames.hold, holdId, {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 72,
    });
  }
  return response;
}
