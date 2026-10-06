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

Demo logins in mock / `APP_TEST_MODE`: portal `demo@kvselfstorage.ca` / `demo1234`;
staff `owner@kvselfstorage.ca` / `Kv-Storage-Demo-2026!` (auto-created in test mode);
test cards `4242 4242 4242 4242` (approve), `4000 0000 0000 0002` (decline),
`4000 0000 0000 0119` (timeout). See [docs/TEST_ENVIRONMENT.md](docs/TEST_ENVIRONMENT.md).

```bash
npm run typecheck && npm run lint && npm test
npm run sitelink:check        # compare against the live SiteLink WSDL
npm run dev:test              # Docker Postgres on :55432 + app on :3001
```

## Deploying (Vercel)

1. Create a **separate** Postgres database for testing (do not share with a future
   live SiteLink deployment) and set `DATABASE_URL`.
2. Set `APP_TEST_MODE=1` and `APP_URL` to the Vercel URL. SiteLink / GHL /
   notify secrets are ignored while test mode is on. Other variables from
   `.env.example` can stay blank.
3. Build command `npm run build`; run `npm run db:migrate` and
   `npm run db:seed` once against the **test** database.
4. Confirm the yellow demo banner and open `/testing` for portal login and card
   scenarios. Scheduled crons are off on Hobby; refresh inventory from the
   staff dashboard after the first deploy if units look empty.
5. When you are ready for live SiteLink, remove `APP_TEST_MODE`, point
   `DATABASE_URL` at a production database, and set real credentials.
