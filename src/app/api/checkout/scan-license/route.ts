import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HOLD_COOKIE } from "@/lib/holds";
import { extractLicense } from "@/lib/license-vision";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { decodeIdPhoto } from "@/lib/tenant-verification";

export const runtime = "nodejs";

/** Reads a licence photo into editable checkout fields. The image is not stored. */
export async function POST(req: Request) {
  const noStore = { "Cache-Control": "no-store" };
  if (!(await cookies()).get(HOLD_COOKIE)?.value) {
    return NextResponse.json({ error: "Please use the device you started checkout on." }, { status: 403, headers: noStore });
  }
  if (!(await rateLimit(`scan-license:${await clientIp()}`, 12, 900))) {
    return NextResponse.json({ error: "Too many scans. Please type your details or call (902) 867-3779." }, { status: 429, headers: noStore });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  }
  const image = typeof body.image === "string" ? body.image : "";
  const photo = decodeIdPhoto(image);
  if (!photo.ok) return NextResponse.json({ error: photo.error }, { status: 400, headers: noStore });

  try {
    const scanned = await extractLicense(image);
    return NextResponse.json({ ...scanned.fields, source: scanned.source }, { headers: noStore });
  } catch (err) {
    log.error("scan license failed", { name: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "We couldn't read that photo. Please type your details." }, { status: 500, headers: noStore });
  }
}
