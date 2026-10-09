# Retell website chat + phone agent → GoHighLevel

KV keeps one FAQ and tool policy in `agent-brain/`. The built-in chat reads it
directly. `/api/agent/brain` exports the filled prompt and function definitions
for Retell setup; changes are not automatically installed in Retell. Analyzed
Retell conversations with contact details save a local lead and send the
contact plus a summary note to GoHighLevel when it is configured. Full
transcripts are not sent to GoHighLevel.

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
   GHL_API_KEY=<sub-account private integration token, contacts.write scope>
   GHL_LOCATION_ID=<matching sub-account location ID>
   # GHL_WEBHOOK_URL=<optional workflow-only alternative if API is not configured>
   ```

4. Fetch the filled prompt and tool definitions:

   `GET https://your-domain/api/agent/brain?channel=website_chat`  
   Header: `Authorization: Bearer $AGENT_TOOL_SECRET`. Copy the returned
   `prompt` into the Retell agent and refresh it there after FAQ/policy edits.
   Retell does not fetch this URL as a live prompt automatically.

5. Register each tool from the JSON response as a Retell custom function
   (use the returned `url`, which already includes `?channel=website_chat`).
   Set each function's `Authorization` header to `Bearer $AGENT_TOOL_SECRET`
   and leave **Payload: args only** off so Retell can include conversation
   metadata for deduplication. Verify that the chat callback includes a
   `chat_id` in preview; if it does not, the lead tool and later webhook may
   create separate local rows. `capture_lead` saves the contact to Postgres and attempts
   GoHighLevel delivery immediately; inspect `ghl_status` in its response.

6. Set the agent **webhook URL** to:

   `https://your-domain/api/retell/webhook`

   Enable `chat_analyzed` (the default event set includes it). `chat_ended`
   is acknowledged without sending to GHL, avoiding a second note before
   analysis is ready. The analysis summary is saved as a GHL contact note.

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
Webhook: same `/api/retell/webhook` (`call_analyzed` performs the GHL sync)

Leads from phone are tagged `retell` in `/admin/leads`.

## How info reaches GoHighLevel

| Path | When | What lands in GHL |
| --- | --- | --- |
| `capture_lead` tool | Mid-chat, as soon as name + phone/email are known | Contact and lead details note, when GHL is configured |
| `/api/retell/webhook` | `chat_analyzed` or `call_analyzed` | Contact and conversation summary note; no full transcript |

Both paths share an `externalId` (`retell:chat:…` / `retell:call:…`) so the
same local lead can receive the later summary. Repeated analyzed deliveries
with an already-sent summary are ignored.

An ambiguous API timeout after GHL has accepted a note may still result in a
second note on retry. Check GHL contact notes when investigating a timeout.

**Recommended:** use a GoHighLevel sub-account Private Integration Token with
`contacts.write` scope as `GHL_API_KEY`, plus `GHL_LOCATION_ID`. The app upserts
the contact, adds its KV tags without replacing existing tags, then creates a
contact note. A failed step is shown in `/admin/leads` and can be retried.
`GHL_WEBHOOK_URL` is an alternative when the API is not configured; its GHL
workflow must map the lead fields and create/update the contact and note.

`APP_TEST_MODE=1` blocks GHL delivery. For a preview integration test, override
it to off and use an isolated preview database. Apply the `Lead.externalId`
migration to that database before enabling the webhook; Vercel builds do not
run database migrations. The existing live project's test mode applies to all
environments until a preview override is set.
For a Neon schema-only branch, migration history rows are absent even though
the tables exist. Apply `prisma/migrations/20261009010000_lead_external_id/migration.sql`
to that branch directly, or restore its migration history before running
`prisma migrate deploy`.

## Fallback

If either public key or chat agent ID is missing, the site keeps the built-in
chat (`ChatWidget` → `/api/chat`), which still uses the shared FAQ and tools
when `CHAT_LLM_API_KEY` is set (otherwise rules-based answers). Built-in chat
leads still use the same configured GHL delivery path via `capture_lead` /
the lead form.
