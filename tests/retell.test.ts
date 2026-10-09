import { describe, expect, it, afterEach } from "vitest";
import { parseAgentChannel } from "@/lib/brain";
import { getRetellWidgetConfig, retellChatConfigured } from "@/lib/retell";

describe("parseAgentChannel", () => {
  it("accepts known channels and falls back otherwise", () => {
    expect(parseAgentChannel("website_chat")).toBe("website_chat");
    expect(parseAgentChannel("retell")).toBe("retell");
    expect(parseAgentChannel("voice")).toBe("voice");
    expect(parseAgentChannel("nope")).toBe("retell");
    expect(parseAgentChannel(null, "website_chat")).toBe("website_chat");
  });
});

describe("getRetellWidgetConfig", () => {
  const keys = [
    "NEXT_PUBLIC_RETELL_PUBLIC_KEY",
    "NEXT_PUBLIC_RETELL_CHAT_AGENT_ID",
    "NEXT_PUBLIC_RETELL_VOICE_PUBLIC_KEY",
    "NEXT_PUBLIC_RETELL_VOICE_AGENT_ID",
    "NEXT_PUBLIC_RETELL_AGENT_VERSION",
    "NEXT_PUBLIC_RETELL_RECAPTCHA_KEY",
    "APP_URL",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
      delete saved[k];
    }
  });

  function setEnv(partial: Partial<Record<(typeof keys)[number], string>>) {
    for (const k of keys) {
      if (!(k in saved)) saved[k] = process.env[k];
      if (k in partial) process.env[k] = partial[k];
      else delete process.env[k];
    }
  }

  it("returns null until both public key and chat agent id are set", () => {
    setEnv({});
    expect(getRetellWidgetConfig()).toBeNull();
    expect(retellChatConfigured()).toBe(false);

    setEnv({ NEXT_PUBLIC_RETELL_PUBLIC_KEY: "key_abc" });
    expect(getRetellWidgetConfig()).toBeNull();

    setEnv({
      NEXT_PUBLIC_RETELL_PUBLIC_KEY: "key_abc",
      NEXT_PUBLIC_RETELL_CHAT_AGENT_ID: "agent_chat",
      APP_URL: "https://kvselfstorage.ca",
      NEXT_PUBLIC_RETELL_VOICE_AGENT_ID: "agent_voice",
      NEXT_PUBLIC_RETELL_VOICE_PUBLIC_KEY: "key_voice",
    });
    expect(getRetellWidgetConfig()).toEqual({
      publicKey: "key_abc",
      chatAgentId: "agent_chat",
      voicePublicKey: "key_voice",
      voiceAgentId: "agent_voice",
      agentVersion: undefined,
      recaptchaKey: undefined,
      logoUrl: "https://kvselfstorage.ca/icon-192.png",
    });
    expect(retellChatConfigured()).toBe(true);
  });
});
