-- ReconOS schema — Phase 1
-- Postgres (Vercel Postgres / Neon). Raw SQL, no ORM.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Dealers
-- ---------------------------------------------------------------------------
CREATE TABLE dealers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  secondary_contact_name  TEXT,
  secondary_contact_email TEXT,
  secondary_contact_phone TEXT,
  payment_terms     TEXT NOT NULL DEFAULT 'net15'
                      CHECK (payment_terms IN ('prepay', 'net15', 'net30', 'due_on_pickup', 'accounts_receivable', 'other')),
  priority_tier     TEXT NOT NULL DEFAULT 'standard'
                      CHECK (priority_tier IN ('standard', 'priority')),
  labor_rate_cents  INTEGER NOT NULL DEFAULT 12000,
  parts_markup_pct  NUMERIC(6,2) NOT NULL DEFAULT 25.00,
  is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Users (shop-side when dealer_id IS NULL, dealer-side otherwise)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     UUID REFERENCES dealers(id) ON DELETE CASCADE,
  role          TEXT NOT NULL
                  CHECK (role IN ('owner', 'advisor', 'tech', 'manager', 'viewer', 'billing')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_side_chk CHECK (
    (dealer_id IS NULL AND role IN ('owner', 'advisor', 'tech')) OR
    (dealer_id IS NOT NULL AND role IN ('manager', 'viewer', 'billing'))
  )
);

CREATE INDEX idx_users_dealer_id ON users(dealer_id);

-- Sessions (server-side session store backing the httpOnly cookie)
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
CREATE TABLE vehicles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id    UUID NOT NULL REFERENCES dealers(id),
  vin          TEXT NOT NULL,
  year         INTEGER,
  make         TEXT,
  model        TEXT,
  trim         TEXT,
  stock_number TEXT,
  color        TEXT,
  odometer     INTEGER,
  photos       JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_dealer_id ON vehicles(dealer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_stock_number ON vehicles(stock_number);

-- ---------------------------------------------------------------------------
-- Labor guide — canned jobs advisors pick from when building an estimate,
-- instead of typing labor hours/parts cost from scratch every time.
-- ---------------------------------------------------------------------------
CREATE TABLE labor_guide_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  category               TEXT NOT NULL DEFAULT 'custom'
                           CHECK (category IN ('mechanical', 'body_paint', 'detail', 'glass', 'electrical', 'custom')),
  default_labor_hours    NUMERIC(6,2) NOT NULL DEFAULT 0,
  default_parts_cost_cents INTEGER NOT NULL DEFAULT 0,
  description            TEXT,
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_labor_guide_items_active ON labor_guide_items(active);

-- ---------------------------------------------------------------------------
-- Recon orders
-- ---------------------------------------------------------------------------
CREATE TABLE recon_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  dealer_id       UUID NOT NULL REFERENCES dealers(id),
  status          TEXT NOT NULL DEFAULT 'intake'
                    CHECK (status IN ('intake', 'inspection', 'pending_approval', 'active', 'qc', 'ready', 'delivered', 'closed')),
  promised_at     DATE,
  promise_reason_log JSONB NOT NULL DEFAULT '[]',
  tekmetric_ro_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMPTZ
);

CREATE INDEX idx_recon_orders_vehicle_id ON recon_orders(vehicle_id);
CREATE INDEX idx_recon_orders_dealer_id ON recon_orders(dealer_id);
CREATE INDEX idx_recon_orders_status ON recon_orders(status);

-- ---------------------------------------------------------------------------
-- RO lines — independently trackable line items
-- ---------------------------------------------------------------------------
CREATE TABLE ro_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_id               UUID NOT NULL REFERENCES recon_orders(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  finding_photos      JSONB NOT NULL DEFAULT '[]',
  labor_hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
  labor_rate_cents    INTEGER NOT NULL DEFAULT 0,
  parts_cost_cents    INTEGER NOT NULL DEFAULT 0,
  parts_price_cents   INTEGER NOT NULL DEFAULT 0,
  total_price_cents   INTEGER NOT NULL DEFAULT 0,
  approval_status     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (approval_status IN ('pending', 'approved', 'declined')),
  approved_by_user_id UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  stage               TEXT NOT NULL DEFAULT 'inspection'
                        CHECK (stage IN ('inspection', 'estimate', 'approval', 'parts', 'mechanical', 'body_paint', 'detail', 'qc', 'ready')),
  tech_id             UUID REFERENCES users(id),
  blocked_reason      TEXT
                        CHECK (blocked_reason IS NULL OR blocked_reason IN ('parts', 'approval', 'sublet', 'payment')),
  stage_entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  labor_guide_item_id UUID REFERENCES labor_guide_items(id),
  last_reminder_sent_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ro_lines_ro_id ON ro_lines(ro_id);
CREATE INDEX idx_ro_lines_stage ON ro_lines(stage);
CREATE INDEX idx_ro_lines_tech_id ON ro_lines(tech_id);
CREATE INDEX idx_ro_lines_approval_status ON ro_lines(approval_status);

-- Comeback documentation: declined lines persist forever and are visible on
-- future ROs for the same VIN. Queried by joining vehicles.vin -> recon_orders -> ro_lines.

-- ---------------------------------------------------------------------------
-- Stage events — full audit trail of every ro_line mutation
-- ---------------------------------------------------------------------------
CREATE TABLE stage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_line_id  UUID NOT NULL REFERENCES ro_lines(id) ON DELETE CASCADE,
  from_stage  TEXT,
  to_stage    TEXT NOT NULL,
  user_id     UUID REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_events_ro_line_id ON stage_events(ro_line_id);

-- ---------------------------------------------------------------------------
-- Parts orders
-- ---------------------------------------------------------------------------
CREATE TABLE parts_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_line_id   UUID NOT NULL REFERENCES ro_lines(id) ON DELETE CASCADE,
  vendor       TEXT,
  description  TEXT,
  cost_cents   INTEGER NOT NULL DEFAULT 0,
  eta_date     DATE,
  status       TEXT NOT NULL DEFAULT 'ordered'
                 CHECK (status IN ('ordered', 'received', 'installed')),
  bin_location TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parts_orders_ro_line_id ON parts_orders(ro_line_id);

-- ---------------------------------------------------------------------------
-- QC checks — one row per completed QC pass/fail on a line
-- ---------------------------------------------------------------------------
CREATE TABLE qc_checks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_line_id   UUID NOT NULL REFERENCES ro_lines(id) ON DELETE CASCADE,
  checklist    JSONB NOT NULL DEFAULT '[]',
  passed       BOOLEAN NOT NULL,
  notes        TEXT,
  checked_by_user_id UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_checks_ro_line_id ON qc_checks(ro_line_id);

-- ---------------------------------------------------------------------------
-- Invoices (Phase 3 payment processing — status tracking only in Phase 1)
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_id          UUID NOT NULL REFERENCES recon_orders(id),
  dealer_id      UUID NOT NULL REFERENCES dealers(id),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  sent_at        TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_ro_id ON invoices(ro_id);
CREATE INDEX idx_invoices_dealer_id ON invoices(dealer_id);

-- ---------------------------------------------------------------------------
-- Estimate snapshots — append-only, immutable versioning
-- ---------------------------------------------------------------------------
CREATE TABLE estimate_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_id            UUID NOT NULL REFERENCES recon_orders(id),
  version          INTEGER NOT NULL,
  snapshot         JSONB NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('sent', 'approved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_estimate_snapshots_ro_id ON estimate_snapshots(ro_id);

-- Only one "sent" snapshot per estimate version (resending the same
-- version is a no-op / bug). "approved" snapshots are NOT unique per
-- version — every individual dealer approve/decline action writes its
-- own "approved" snapshot against whichever version it's deciding on, so
-- there can be many per version.
CREATE UNIQUE INDEX estimate_snapshots_sent_version_uniq
  ON estimate_snapshots (ro_id, version) WHERE kind = 'sent';

-- No UPDATE/DELETE ever performed against estimate_snapshots at the
-- application layer — enforced by convention (application code) since a
-- blanket DB-level trigger would also block legitimate corrective admin
-- work; the API layer never issues UPDATE/DELETE against this table.

-- ---------------------------------------------------------------------------
-- Inspections — permanent record independent of whether findings became
-- estimate lines
-- ---------------------------------------------------------------------------
CREATE TABLE inspections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_id        UUID NOT NULL REFERENCES recon_orders(id),
  tech_id      UUID REFERENCES users(id),
  checklist    JSONB NOT NULL DEFAULT '[]',
  findings     JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_ro_id ON inspections(ro_id);

-- ---------------------------------------------------------------------------
-- Documents — index for the portal document library
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  dealer_id  UUID NOT NULL REFERENCES dealers(id),
  type       TEXT NOT NULL CHECK (type IN ('inspection', 'estimate', 'invoice', 'delivery_record')),
  ref_id     UUID NOT NULL,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_dealer_id ON documents(dealer_id);
CREATE INDEX idx_documents_vehicle_id ON documents(vehicle_id);
CREATE INDEX idx_documents_type ON documents(type);

-- ---------------------------------------------------------------------------
-- Alert preferences & notifications log
-- ---------------------------------------------------------------------------
CREATE TABLE alert_prefs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
                'estimate_ready', 'approval_needed', 'approval_reminder',
                'promise_date_changed', 'qc_passed', 'ready_for_pickup', 'invoice_sent'
              )),
  channel    TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, event_type, channel)
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  channel    TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ---------------------------------------------------------------------------
-- Settings — shop-wide configuration (single row keyed table)
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('daily_capacity_hours', '24'),
  ('working_days', '["mon","tue","wed","thu","fri","sat"]'),
  ('default_parts_eta_days', '3');
