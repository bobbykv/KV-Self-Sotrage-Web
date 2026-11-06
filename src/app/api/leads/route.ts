import { NextResponse } from "next/server";
import { captureLead, leadSchema } from "@/lib/leads";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (body.website) return NextResponse.json({ ok: true });
  if (!(await rateLimit(`lead:${await clientIp()}`, 8, 3600))) return NextResponse.json({ error: "Too many requests. Please call (902) 867-3779." }, { status: 429 });

  const channel = body.channel === "website_chat" ? "website_chat" : "website_form";
  const parsed = leadSchema.safeParse({ ...body, channel, phone: body.phone ?? "", email: body.email ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "Please add your name and a valid phone or email." }, { status: 400 });
  if (!parsed.data.phone && !parsed.data.email) return NextResponse.json({ error: "Please add a phone number or email so we can reach you." }, { status: 400 });
  try {
    const lead = await captureLead(parsed.data);
    log.info("website lead saved", { leadId: lead.id, reason: lead.reason, delivery: lead.ghlStatus });
    return NextResponse.json({ ok: true, reference: lead.id });
  } catch (err) {
    log.error("website lead capture failed", { err });
    return NextResponse.json({ error: "We couldn't save your request. Your details are still here. Please try again or call (902) 867-3779." }, { status: 500 });
  }
}
