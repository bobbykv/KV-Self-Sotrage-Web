# Architecture

One Next.js (App Router) app serves the public site, the tenant portal, the
staff console (`/admin`) and the HTTP tools the Retell voice agent calls.
Postgres (Prisma) holds everything that is *ours*; SiteLink stays the source of
truth for units, tenants, reservations, ledgers and money.

```
Browser ──► Next.js server (route handlers / server actions)
              ├── src/lib/sitelink/*   SOAP client generated from the live WSDL
              ├── Postgres             inventory snapshots, holds, leads, CMS, queues, staff, audit
              ├── GoHighLevel          lead webhook or LeadConnector API
              ├── LLM (optional)       website chat, tool-calling only
              └── NOTIFY_WEBHOOK_URL   staff alerts
Staff dashboard ► refresh cache · run reports   (same work as /api/cron/*, which is not scheduled)
Retell ──────► /api/agent/brain · /api/agent/tools/*  (Bearer AGENT_TOOL_SECRET)
```

## SiteLink usage and the API budget

* **Inventory** is read from Postgres, never live on page view. Staff press
  “Refresh SiteLink cache” (or call `/api/cron/inventory` with `CRON_SECRET`)
  to poll `UnitsInformationAvailableUnitsOnly_v2` with `lngLastTimePolled`.
  “Run reports now” (or `/api/cron/nightly`) forces a full refresh
  (`lngLastTimePolled = 0`) and rebuilds the all-units / price-list snapshots.
  Vercel Cron is not configured, so this deploys on the Hobby plan.
* **Live calls** happen only on actions: hold (`UnitsInformationByUnitID` →
  `TenantSearchDetailed` / `TenantNewDetailed_v3` → `ReservationNewWithSource_v5`
  → `MoveInCostRetrieveWithDiscount_Reservation_v4`), checkout, portal sign-in
  and portal pages.
* **Reporting API** (`PastDueBalances`, `MoveInsAndMoveOuts`,
  `OccupancyStatistics`) runs only when staff press “Run reports”, never on a
  customer request.
* Every call increments `ApiCallCounter` (per location per month). The
  dashboard shows usage against the 10,000/location/month allowance.
* A Postgres job lock prevents two refreshes running at once.

## Holds (20 minutes by default)

1. Fresh `UnitsInformationByUnitID` confirms the unit is still vacant.
2. A `Hold` row is inserted. A partial unique index
   (`one active hold per unit`) makes double-holds impossible even if two
   people click at the same moment.
3. The tenant is found by email (`TenantSearchDetailed`) or created.
4. `ReservationNewWithSource_v5` with `QTRentalTypeID = 2` (reservation),
   `iSource = 5` (website) and `dExpires = now + holdMinutes`.
5. The move-in cost (`MoveInCostRetrieveWithDiscount_Reservation_v4`) is
   stored on the hold for the checkout breakdown.

Held units disappear from the public list immediately. Expired holds are swept
when inventory is refreshed and on page load.

## Checkout and the HST line

The cost breakdown always shows **HST as its own line before any payment
step**. If SiteLink returns tax columns we use them (`taxSource = sitelink`);
if it returns none we compute HST at `HST_RATE` so tax is never hidden
(`taxSource = computed`, flagged in the admin holds view).

## Payments — owner decision required

`PAYMENT_MODE` controls what happens after the breakdown. **The default is
`pay_separately`.** We have not silently chosen card pass-through.

| Mode | What the customer does | PCI exposure |
| --- | --- | --- |
| `pay_separately` (default) | Confirms the reservation online; it is extended to `confirmedReservationHours` and staff are notified. Customer pays by phone, at the office, or at `PAY_ONLINE_URL`. | None — no card data touches our servers. |
| `passthrough` | Enters card details in checkout. `/api/checkout/[id]/pay` sends them straight to `MoveInWithDiscount_v7` over TLS. | Our server handles raw PAN/CVV in memory → **SAQ D** scope for KV. |

Pass-through rules enforced in code:

* The card form posts JSON to one Node route; card fields are never in a
  server action, form state, URL, cookie, DB row, log line or analytics event.
* `src/lib/redact.ts` scrubs PANs, CVVs, expiry and SiteLink passwords from
  every log line and stored error message; SOAP envelopes are never logged.
* After 3 declines the hold is marked `payment_failed` and the customer is
  asked to call.
* No tokenised/hosted SiteLink payment method has been assumed. If SiteLink
  offers one, it should replace pass-through (open question in
  [SITELINK.md](SITELINK.md)).

**Refunds are never automated.** All copy says the owner handles refunds
manually.

## Tenant portal

Sign-in tries `TenantLogin` at each of the three locations, so one email works
everywhere. Sessions are random tokens stored hashed (sha256) in Postgres,
2-hour cookie. The portal shows balance / past due, units and access codes,
autopay status, lease (fresh `SiteLinkeSignCreateLeaseURL_v2` link per click,
with a “call us” fallback when eSign isn't set up for a site), move-out
scheduling (`ScheduleMoveOut`), maintenance requests (staff queue) and
unit-change requests (staff queue — never an automatic SiteLink transfer).
Noke instructions are shown for Highway 4 and Stellarton only.

## Leads (units that aren't available)

Leads are written to Postgres first, then sent to GoHighLevel (webhook or
LeadConnector `contacts/upsert` + note) with `source = website`. Failed sends
stay visible in `/admin/leads` with a retry button. We never create fake
SiteLink reservations to capture interest.

## Shared agent brain (website chat + Retell)

`agent-brain/brain.md` (prompt), `agent-brain/faq.md` (canonical FAQ, editable
in `/admin/faq`) and `agent-brain/tools.json` (tool schema) are the single
source for both channels. `/api/agent/brain?channel=retell` returns the filled
prompt + tool URLs for Retell; the website chat uses the same loader with
`channel = website_chat`. Tools: `search_units` (cached inventory, real prices
only), `get_faq`, `capture_lead`, `handoff_to_human`. The chat never takes card
numbers (anything that looks like a PAN is dropped before it reaches a model)
and does not use any SiteLink AI features.

## Staff console

Email + strong password (≥ 12 chars, 3 character classes), bcrypt cost 12,
lockout after 5 failures for 15 minutes, 12-hour sessions, every change written
to `AuditLog`. No 2FA (per owner). SiteLink credentials are never shown in the
console — only whether each integration is configured.

## Open items carried into go-live

* Navy brand colour `#1a2a3b` was sampled from the logo; confirm the exact hex.
* Promotions are display-only; matching discounts must exist in SiteLink.
* No customer reviews are shown until real ones are supplied (`src/content/reviews.ts`).
* Noke unlock is not integrated; the portal links customers to the Noke app.
* Scheduled refreshes are off so the site deploys on Vercel's Hobby plan. Put the cron entries back in `vercel.json` on Pro: inventory `*/30 * * * *`, nightly `15 7 * * *`. Until then, use the dashboard buttons.
