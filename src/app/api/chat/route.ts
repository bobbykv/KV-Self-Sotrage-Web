import { NextResponse } from "next/server";
import { z } from "zod";
import { chat, greeting } from "@/lib/chat/engine";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(40),
});

export async function POST(req: Request) {
  const settings = await getSettings();
  if (!settings.chatEnabled) return NextResponse.json({ reply: "Chat is offline right now. Please call (902) 867-3779.", actions: [{ type: "call" }] });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ reply: "Sorry, I didn't catch that.", actions: [] }, { status: 400 });
  if (!parsed.data.messages.length) return NextResponse.json(greeting());

  const ip = await clientIp();
  if (!(await rateLimit(`chat:${ip}`, 30, 600)) || !(await rateLimit(`chat-day:${ip}`, 200, 86400))) {
    return NextResponse.json({ reply: "For more help with your questions, please call (902) 867-3779.", actions: [{ type: "call" }] }, { status: 429 });
  }
  return NextResponse.json(await chat(parsed.data.messages));
}
