# ReconOS

Shop management system for Grid Auto Recon LLC — an internal shop app for
running the recon pipeline and a dealer portal for live status, estimate
approvals, and permanent documents.

**Phase 1:** auth + roles, dealer CRUD + rate cards, VIN-decode intake,
RO/lines, kanban board with stage transitions + audit trail, estimate
builder, inspection capture, estimate snapshots + versioning, dealer portal
with approvals + document library, promise date engine v1, notification
service (mock SMS), seed data.

**Phase 2 (in progress):** a labor guide (canned jobs advisors pick from
instead of typing hours from scratch), parts ordering with ETA-driven
promise-date recalculation, a QC checklist gate before a line can reach
"ready," an approval-escalation cron, and an analytics dashboard (cycle-time
decomposition, throughput, approval rate by job category, per-dealer
revenue/cycle-time/response-time, filterable internal vs. customer-pay).

## Stack

- React 18 (Vite) + Tailwind CSS v4 + lucide-react + recharts
- Vercel serverless functions under `/api` (plain Node, no framework)
- Postgres (Vercel Postgres / Neon) via `pg`, raw SQL — no ORM
- Auth: email + password, bcrypt, httpOnly session cookies, roles enforced
  server-side on every route
- SMS via Twilio, or logged to the console when `MOCK_SMS=true`
- VIN decode via the NHTSA vPIC API (called client-side, no key required)
- Vercel Cron for the daily approval-escalation job

## Local setup

1. Install dependencies:

   ```
   npm install
   ```

2. Point at a Postgres database (Vercel Postgres, Neon, or local) and copy
   `.env.example` to `.env`, filling in `DATABASE_URL`.

3. Run the schema migration and seed data:

   ```
   npm run db:migrate
   npm run db:seed
   ```

   **`db:migrate` drops and recreates the entire `public` schema every time**
   — the schema is still under active change, so this trades "always matches
   schema.sql" for "destroys existing data." Always follow it with
   `db:seed`. Don't run `db:migrate` again later without expecting to reseed.

   The seed script creates 2 dealers (Metro Auto Group, and Grid Auto Sales
   as the internal dealer), a user for every role, a starter labor guide
   catalog, and 9 vehicles — 8 spread across the pipeline stages plus one
   already-delivered vehicle with a full stage history so the analytics
   charts have more than one data point. All seeded users share the password
   `password123` — see the seed script's console output for the full login
   list.

4. Run the app. The frontend (Vite) and the `/api` serverless functions need
   to be served together — the simplest way is the Vercel CLI:

   ```
   npm install -g vercel
   vercel dev
   ```

   Alternatively run `vite` on its own (`npm run dev`) with `vercel dev
   --listen 3000` in a second terminal — `vite.config.js` proxies `/api` to
   `localhost:3000` for that setup.

5. (Optional, production only) Set a `CRON_SECRET` env var in your Vercel
   project so the approval-escalation cron (`vercel.json` → `crons`) is
   authenticated — Vercel sends it automatically as a bearer token on cron
   requests. Without it the endpoint runs unauthenticated locally, which is
   fine for `vercel dev`.

## Project layout

- `db/schema.sql` — full Postgres schema
- `db/migrate.js` — runs schema.sql via `pg` (no `psql` CLI required)
- `db/seed.js` — seed data
- `api/` — one file per REST endpoint (Vercel serverless functions); `api/_lib`
  holds shared helpers (db pool, session auth, notify service, promise date
  engine, estimate snapshot writer). `api/package.json` pins this subtree to
  CommonJS since the root project is `"type": "module"`.
- `api/cron/approval-escalation.js` — Vercel Cron target, scheduled in
  `vercel.json`
- `src/pages/shop/*` — internal shop app (`/shop/...`)
- `src/pages/portal/*` — dealer portal (`/portal/...`)

## Known limitations

- Photos are captured as base64 data URLs stored directly in Postgres jsonb
  columns — fine for demo volumes, but should move to real object storage
  (e.g. Vercel Blob) before production use.
- Invoicing exists only as status tracking (draft/sent/paid) — ACH payment
  via Stripe is Phase 3.
- The promise date engine recalculates the RO it's called for; it doesn't
  cascade to every RO behind it in the queue (kept simple per the v1 spec).
- The approval-escalation cron is scheduled daily (`0 9 * * *`) rather than
  hourly — Vercel's Hobby plan only allows daily cron jobs. A line pending
  >24h gets its reminder at the next daily run, not the instant it crosses
  24h. Upgrade the schedule if you're on a Pro plan and want finer granularity.
- Cycle-time-by-week attributes a whole stage duration to the week it
  started in rather than splitting it across a week boundary — a reasonable
  v1 simplification, revisit if week-over-week numbers look off near
  boundaries.
- The labor guide (`db/laborGuideCatalog.js`, ~65 items) is a shop-curated
  set of default hours/parts costs, **not licensed MOTOR/Mitchell1
  flat-rate data** — MOTOR times are a paid commercial product typically
  licensed to software vendors rather than sold as a self-serve API to an
  individual shop. If/when Grid Auto Recon licenses real MOTOR (or
  Mitchell1) data, the intended integration point is a sync job that
  upserts into the existing `labor_guide_items` table (add a
  `motor_operation_code` column to match on) rather than replacing this
  catalog — advisors keep the same picker UI either way.
