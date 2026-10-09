# Retell website chat + phone agent → GoHighLevel

KV keeps one FAQ and tool policy in `agent-brain/`. Retell (and the built-in
chat) both consume that brain. **Every finished Retell conversation is pushed
to GoHighLevel** when GHL is configured.

## Website chat widget

1. In the Retell dashboard, create a **Chat Agent**.
2. Create a **Public Key** and whitelist your site domain (and `localhost` for local dev).
3. Set env vars (Vercel / `.env`):

   ```
   NEXT_PUBLIC_RETELL_PUBLIC_KEY=key_...
   NEXT_PUBLIC_RETELL_CHAT_AGENT_ID=agent_...
   AGENT_TOOL_SECRET=<same secret Retell will send as Bearer, ≥16 chars>
   RETELL_API_KEY=<Retell API key with the webhook badge>
   APP_URL=https://your-domain
   GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/...   # preferred
   # or GHL_API_KEY + GHL_LOCATION_ID for LeadConnector contact upsert
   ```

4. Point the chat agent's prompt at:

   `GET https://your-domain/api/agent/brain?channel=website_chat`  
   Header: `Authorization: Bearer $AGENT_TOOL_SECRET`

5. Register each tool from the JSON response as a Retell custom function
   (use the returned `url`, which already includes `?channel=website_chat`).
   `capture_lead` writes the contact to Postgres **and** GoHighLevel immediately.

6. Set the agent **webhook URL** to:

   `https://your-domain/api/retell/webhook`

   Events: `chat_ended`, `chat_analyzed` (defaults are fine). On each finished
   chat the webhook posts the full transcript, summary, and contact to
   `GHL_WEBHOOK_URL`, and upserts a contact when phone/email is present.

7. Redeploy. With chat enabled in `/admin` settings, the Retell FAB replaces the
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
Webhook: same `/api/retell/webhook` (handles `call_ended` / `call_analyzed`)

Leads from phone are tagged `retell` in `/admin/leads`.

## How info reaches GoHighLevel

| Path | When | What lands in GHL |
| --- | --- | --- |
| `capture_lead` tool | Mid-chat, as soon as name + phone/email are known | Contact (webhook and/or LeadConnector upsert) |
| `/api/retell/webhook` | Chat/call ends or is analyzed | Full payload: transcript, summary, sentiment, contact, tags |

Both paths share an `externalId` (`retell:chat:…` / `retell:call:…`) so the
same conversation is not created twice.

**Recommended:** set `GHL_WEBHOOK_URL` to a GHL workflow webhook so the rich
Retell payload (including transcript) drives your pipeline. Add
`GHL_API_KEY` + `GHL_LOCATION_ID` if you also want LeadConnector contact upsert.

## Fallback

If either public key or chat agent ID is missing, the site keeps the built-in
chat (`ChatWidget` → `/api/chat`), which still uses the shared FAQ and tools
when `CHAT_LLM_API_KEY` is set (otherwise rules-based answers). Built-in chat
leads still go to GHL via `capture_lead` / the lead form.
