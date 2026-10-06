# KV Self Storage — website, tenant portal and staff console

Mobile-first site for [kvselfstorage.ca](https://kvselfstorage.ca) covering the
three KV locations (Antigonish · Highway 4 / Addington Forks · Stellarton),
backed by SiteLink.

* **Public site** — live (cached) unit availability, size finder, 20-minute
  online holds, checkout with a full fee breakdown and HST shown before
  payment, lead capture into GoHighLevel for sold-out sizes, FAQ, local SEO
  pages, blog, promotions, website chat.
* **Tenant portal** (`/portal`) — balance, lease, access code, autopay status,
  move-out scheduling, maintenance and unit-change requests.
* **Staff console** (`/admin`) — dashboards, units, tenant lookup, holds and
  failed payments, cache status and API usage, leads (CSV export),
  maintenance and unit-change queues, blog and promotions CMS, FAQ / agent
  brain editor, feature flags, staff accounts, audit log.
* **Retell** — `/api/agent/brain` and `/api/agent/tools/*` give the phone agent
  the same prompt, FAQ and tools as the website chat.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (including the **payment-mode
decision**) and [docs/SITELINK.md](docs/SITELINK.md) (verified vs. unverified
SiteLink details and go-live questions).

## Local development

Requires Node 20+ and Postgres.

```bash
cp .env.example .env          # leave SiteLink blank to use demo data
npm install
npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Choose-A-Strong-Pass-1' npm run db:seed
npm run dev
```

Demo logins in mock mode: portal `demo@kvselfstorage.ca` / `demo1234`; test
card `4242 4242 4242 4242` (only when `PAYMENT_MODE=passthrough`).

```bash
npm run typecheck && npm run lint && npm test
npm run sitelink:check        # compare against the live SiteLink WSDL
```

## Deploying (Vercel)

1. Create a Postgres database and set `DATABASE_URL`.
2. Set the environment variables from `.env.example` (SiteLink, GHL, secrets).
   Credentials live only in the host's environment settings.
3. Build command `npm run build`; run `npm run db:migrate` and
   `npm run db:seed` once against production.
4. Scheduled crons are off, so this deploys on the free Hobby plan. Refresh
   inventory and reports from the staff dashboard. The `/api/cron/*` routes
   are still there if you later add a scheduler; they expect `CRON_SECRET`.
5. In Retell, point the agent at `GET /api/agent/brain?channel=retell` with
   `Authorization: Bearer $AGENT_TOOL_SECRET` and register the returned tools.
