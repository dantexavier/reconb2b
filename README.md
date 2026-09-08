# ReconOS

Shop management system for Grid Auto Recon LLC — an internal shop app for
running the recon pipeline and a dealer portal for live status, estimate
approvals, and permanent documents.

Phase 1 (this build): auth + roles, dealer CRUD + rate cards, VIN-decode
intake, RO/lines, kanban board with stage transitions + audit trail,
estimate builder, inspection capture, estimate snapshots + versioning,
dealer portal with approvals + document library, promise date engine v1,
notification service (mock SMS), seed data.

## Stack

- React 18 (Vite) + Tailwind CSS v4 + lucide-react + recharts
- Vercel serverless functions under `/api` (plain Node, no framework)
- Postgres (Vercel Postgres / Neon) via `pg`, raw SQL — no ORM
- Auth: email + password, bcrypt, httpOnly session cookies, roles enforced
  server-side on every route
- SMS via Twilio, or logged to the console when `MOCK_SMS=true`
- VIN decode via the NHTSA vPIC API (called client-side, no key required)

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

   The seed script creates 2 dealers (Metro Auto Group, and Grid Auto Sales
   as the internal dealer), a user for every role, and 8 vehicles spread
   across the pipeline. All seeded users share the password `password123` —
   see the seed script's console output for the full login list.

4. Run the app. The frontend (Vite) and the `/api` serverless functions need
   to be served together — the simplest way is the Vercel CLI:

   ```
   npm install -g vercel
   vercel dev
   ```

   Alternatively run `vite` on its own (`npm run dev`) with `vercel dev
   --listen 3000` in a second terminal — `vite.config.js` proxies `/api` to
   `localhost:3000` for that setup.

## Project layout

- `db/schema.sql` — full Postgres schema
- `db/seed.js` — Phase 1 seed data
- `api/` — one file per REST endpoint (Vercel serverless functions); `api/_lib`
  holds shared helpers (db pool, session auth, notify service, promise date
  engine, estimate snapshot writer). `api/package.json` pins this subtree to
  CommonJS since the root project is `"type": "module"`.
- `src/pages/shop/*` — internal shop app (`/shop/...`)
- `src/pages/portal/*` — dealer portal (`/portal/...`)

## Known Phase 1 limitations

- Photos are captured as base64 data URLs stored directly in Postgres jsonb
  columns — fine for demo volumes, but should move to real object storage
  (e.g. Vercel Blob) before production use.
- Analytics, QC checklists, parts ordering + ETA-driven promise recalc, and
  the approval-escalation cron are Phase 2 per the build plan. `parts_orders`
  exists in the schema for forward compatibility but has no API/UI yet.
- Invoicing exists only as status tracking (draft/sent) — ACH payment via
  Stripe is Phase 3.
- The promise date engine recalculates the RO it's called for; it doesn't
  cascade to every RO behind it in the queue (kept simple per the v1 spec).
