"use client";

import Script from "next/script";
import type { RetellWidgetConfig } from "@/lib/retell";

/**
 * Embeds Retell's production chat widget (optional hybrid voice).
 * Credentials stay on the public key + agent ID — no private Retell API key in the browser.
 */
export function RetellChatWidget(config: RetellWidgetConfig) {
  const attrs: Record<string, string> = {
    "data-public-key": config.publicKey,
    "data-agent-id": config.chatAgentId,
    "data-title": "Ask KV Self Storage",
    "data-fab-text": "Ask KV Self Storage",
    "data-bot-name": "KV Self Storage",
    "data-popup-message": "Need help picking a size or checking availability? Ask me.",
    "data-show-ai-popup": "true",
    "data-show-ai-popup-time": "8",
    "data-auto-open": "false",
    "data-theme-color": "#1a2a3b",
    "data-component-color": "#790909",
  };
  if (config.voicePublicKey) attrs["data-voice-public-key"] = config.voicePublicKey;
  if (config.voiceAgentId) attrs["data-voice-agent-id"] = config.voiceAgentId;
  if (config.agentVersion) attrs["data-agent-version"] = config.agentVersion;
  if (config.logoUrl) attrs["data-logo-url"] = config.logoUrl;
  if (config.recaptchaKey) attrs["data-recaptcha-key"] = config.recaptchaKey;

  return (
    <>
      {config.recaptchaKey && (
        <Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(config.recaptchaKey)}`} strategy="afterInteractive" />
      )}
      <Script id="retell-widget" src="https://dashboard.retellai.com/retell-widget-v2.js" type="module" strategy="afterInteractive" {...attrs} />
    </>
  );
}
