# Hosted and local rental / portal test environment

This is KV's own simulator — not a SiteLink or payment-provider sandbox. It does
not verify real payment processing or Nokē access.

## Vercel (existing website link)

Use a **separate Postgres database** from any future live database. Point the
Vercel project at that database and enable the simulator:

| Variable | Value |
| --- | --- |
| `APP_TEST_MODE` | `1` |
| `DATABASE_URL` | Postgres URL for the **test** database only |
| `APP_URL` | `https://kv-self-storage-web.vercel.app` (or your custom domain) |
| `SITELINK_MODE` | leave blank or `mock` (forced to mock when `APP_TEST_MODE=1`) |
| SiteLink / GHL / `NOTIFY_WEBHOOK_URL` / `PAY_ONLINE_URL` / `CHAT_LLM_API_KEY` | may stay set; they are **ignored** while `APP_TEST_MODE=1` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | optional custom staff account; test mode also auto-creates `owner@kvselfstorage.ca` |

After setting env vars (Production + Preview if you use both):

```sh
# against the TEST database URL only
DATABASE_URL='…test…' npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Choose-A-Strong-Pass-1' DATABASE_URL='…test…' npm run db:seed
```

Redeploy. Open the site, confirm the yellow demo banner, then:

* Instructions: `/testing`
* Portal: `/portal/login` → `demo@kvselfstorage.ca` / `demo1234`
* Staff: `/admin/login` → `owner@kvselfstorage.ca` / `Kv-Storage-Demo-2026!`
  (created automatically when `APP_TEST_MODE=1`; no separate seed required)

Fake rentals, holds, sessions and the mock SiteLink facility state are stored in
Postgres (`MockSiteLinkState`), so they survive Vercel cold starts.

Optional: turn on Vercel Deployment Protection (password) so only the team can
reach the simulator while it is on the public hostname.

## Local Docker simulator

Install Docker Desktop, then:

```sh
npm ci
npm run dev:test
```

Open http://localhost:3001/testing. The launcher starts Postgres on local port
`55432`, applies migrations only to `kv_self_storage_test`, and runs the app on
port `3001`. Stop the app with Ctrl+C. To stop the test database without deleting
data:

```sh
docker compose -f compose.test.yml stop
```

## What is isolated

* `APP_TEST_MODE=1` forces simulated SiteLink and card payments even if `.env`
  contains live credentials.
* Direct live SOAP calls throw before `fetch`.
* GHL delivery, staff webhooks, external payment links and paid AI chat are
  disabled.
* Authentication and checkout use separate test cookie names
  (`kv_test_tenant`, `kv_test_admin`, `kv_test_hold`).
* The `/testing` page returns 404 outside test mode.
* No Nokē integration is called. Displayed access codes are sample data.

Do not use real customers or card details in this simulator.

## Payment scenarios

| Simulator-only number | Result |
| --- | --- |
| 4242 4242 4242 4242 | Approved fake rental |
| 4000 0000 0000 0002 | Declined, no rental created |
| 4000 0000 0000 0119 | Simulated transport timeout, no rental created |

Use a future expiry, any 3-digit security code, and a fictional name/address.

## Portal scenarios

Sign in with `demo@kvselfstorage.ca` / `demo1234`. It has a Haley Road unit with
an overdue balance and a Stellarton unit with autopay on. Test unit details,
balances, sample access codes, demo leases, maintenance reports, unit-change
requests and scheduling a move-out. These requests stay in the test DB.

Complete a simulated rental with a new fictional email, set a password on its
confirmation, and sign in as that fake customer. Paying an existing portal
balance is not simulated (the external pay link is disabled in test mode).

## Persistence

Mock SiteLink records (units, tenants, reservations, ledgers) live in Postgres
and persist across serverless restarts. Website holds, sessions and staff queues
use the same test database.

## Validation

```sh
npm test
npm run typecheck
```

Automated tests cover test-mode isolation, live-call blocking, payment approve /
decline / timeout, repeat move-in rejection, and portal ledger ownership helpers.
They do not prove real processor idempotency.
