# Retell website chat + phone agent

KV keeps one FAQ and tool policy in `agent-brain/`. Retell (and the built-in
chat) both consume that brain.

## Website chat widget

1. In the Retell dashboard, create a **Chat Agent**.
2. Create a **Public Key** and whitelist your site domain (and `localhost` for local dev).
3. Set env vars (Vercel / `.env`):

   ```
   NEXT_PUBLIC_RETELL_PUBLIC_KEY=key_...
   NEXT_PUBLIC_RETELL_CHAT_AGENT_ID=agent_...
   AGENT_TOOL_SECRET=<same secret Retell will send as Bearer, ≥16 chars>
   APP_URL=https://your-domain
   ```

4. Point the chat agent's prompt at:

   `GET https://your-domain/api/agent/brain?channel=website_chat`  
   Header: `Authorization: Bearer $AGENT_TOOL_SECRET`

5. Register each tool from the JSON response as a Retell custom function
   (use the returned `url`, which already includes `?channel=website_chat`).

6. Redeploy. With chat enabled in `/admin` settings, the Retell FAB replaces the
   built-in "Ask KV Self Storage" widget.

Optional hybrid voice inside the same widget:

```
NEXT_PUBLIC_RETELL_VOICE_PUBLIC_KEY=key_...
NEXT_PUBLIC_RETELL_VOICE_AGENT_ID=agent_...
```

Optional Google reCAPTCHA v3 (enable abuse prevention on the public key first):

```
NEXT_PUBLIC_RETELL_RECAPTCHA_KEY=<reCAPTCHA v3 site key>
```

## Phone / voice agent

Same brain, default channel:

`GET /api/agent/brain?channel=retell`  
Tools: `/api/agent/tools/{name}?channel=retell`

Leads from phone tools are tagged `retell` in `/admin/leads`.

## Fallback

If either public key or chat agent ID is missing, the site keeps the built-in
chat (`ChatWidget` → `/api/chat`), which still uses the shared FAQ and tools
when `CHAT_LLM_API_KEY` is set (otherwise rules-based answers).
