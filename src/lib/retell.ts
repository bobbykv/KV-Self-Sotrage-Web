/**
 * Public Retell widget credentials (safe for the browser).
 * When both public key and chat agent ID are set, the site embeds Retell's
 * chat widget instead of the built-in rules/LLM chat.
 */
export type RetellWidgetConfig = {
  publicKey: string;
  chatAgentId: string;
  voicePublicKey?: string;
  voiceAgentId?: string;
  agentVersion?: string;
  recaptchaKey?: string;
  logoUrl?: string;
};

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

/** Returns widget config when Retell chat is fully configured; otherwise null. */
export function getRetellWidgetConfig(appUrl?: string): RetellWidgetConfig | null {
  const publicKey = trim(process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY);
  const chatAgentId = trim(process.env.NEXT_PUBLIC_RETELL_CHAT_AGENT_ID);
  if (!publicKey || !chatAgentId) return null;

  const base = (appUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  return {
    publicKey,
    chatAgentId,
    voicePublicKey: trim(process.env.NEXT_PUBLIC_RETELL_VOICE_PUBLIC_KEY),
    voiceAgentId: trim(process.env.NEXT_PUBLIC_RETELL_VOICE_AGENT_ID),
    agentVersion: trim(process.env.NEXT_PUBLIC_RETELL_AGENT_VERSION),
    recaptchaKey: trim(process.env.NEXT_PUBLIC_RETELL_RECAPTCHA_KEY),
    logoUrl: base ? `${base}/icon-192.png` : undefined,
  };
}

export function retellChatConfigured(): boolean {
  return getRetellWidgetConfig() !== null;
}
