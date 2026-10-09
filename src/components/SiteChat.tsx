"use client";

import dynamic from "next/dynamic";
import type { RetellWidgetConfig } from "@/lib/retell";

const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => ({ default: m.ChatWidget })), { ssr: false });
const RetellChatWidget = dynamic(() => import("./RetellChatWidget").then((m) => ({ default: m.RetellChatWidget })), { ssr: false });

/** Lazy client mount so chat JS/scripts stay off the critical path. */
export function SiteChat({ retell }: { retell: RetellWidgetConfig | null }) {
  if (retell) return <RetellChatWidget {...retell} />;
  return <ChatWidget />;
}
