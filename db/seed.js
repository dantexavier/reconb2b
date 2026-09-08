/**
 * Phase 1 seed script — 2 dealers (incl. Grid Auto Sales internal), users
 * for every role, 8 vehicles spread across pipeline stages.
 *
 * Usage: DATABASE_URL=postgres://... node db/seed.js
 */
const { getPool } = require('../api/_lib/db');
const { hashPassword } = require('../api/_lib/auth');

const DEFAULT_PASSWORD = 'password123';

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing existing data...');
    await client.query(`
      TRUNCATE TABLE notifications, alert_prefs, documents, inspections, estimate_snapshots,
        invoices, parts_orders, stage_events, ro_lines, recon_orders, vehicles,
        sessions, users, dealers RESTART IDENTITY CASCADE
    `);

    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    console.log('Creating dealers...');
    const { rows: dealerRows } = await client.query(
      `INSERT INTO dealers (name, contact_name, contact_email, contact_phone, secondary_contact_name, secondary_contact_email,
                             payment_terms, priority_tier, labor_rate_cents, parts_markup_pct, is_internal)
       VALUES
        ('Metro Auto Group', 'Chris Nguyen', 'manager@metroauto.dev', '555-0101', 'Pat Kim', 'viewer@metroauto.dev',
         'net30', 'priority', 13500, 30.0, FALSE),
        ('Grid Auto Sales', 'Taylor Brooks', 'manager@gridauto.dev', '555-0201', NULL, NULL,
         'prepay', 'standard', 9500, 15.0, TRUE)
       RETURNING id, name`
    );
    const metro = dealerRows.find((d) => d.name === 'Metro Auto Group');
    const grid = dealerRows.find((d) => d.name === 'Grid Auto Sales');

    console.log('Creating users...');
    const shopUsers = [
      { role: 'owner', name: 'Dana Reyes', email: 'owner@reconos.dev', phone: '555-0001' },
      { role: 'advisor', name: 'Amir Patel', email: 'advisor@reconos.dev', phone: '555-0002' },
      { role: 'tech', name: 'Jordan Lee', email: 'tech1@reconos.dev', phone: '555-0003' },
      { role: 'tech', name: 'Sam Rivera', email: 'tech2@reconos.dev', phone: '555-0004' },
    ];
    const dealerUsers = [
      { dealerId: metro.id, role: 'manager', name: 'Chris Nguyen', email: 'manager@metroauto.dev', phone: '555-0101' },
      { dealerId: metro.id, role: 'viewer', name: 'Pat Kim', email: 'viewer@metroauto.dev', phone: '555-0102' },
      { dealerId: metro.id, role: 'billing', name: 'Morgan Diaz', email: 'billing@metroauto.dev', phone: '555-0103' },
      { dealerId: grid.id, role: 'manager', name: 'Taylor Brooks', email: 'manager@gridauto.dev', phone: '555-0201' },
      { dealerId: grid.id, role: 'viewer', name: 'Jamie Fox', email: 'viewer@gridauto.dev', phone: '555-0202' },
    ];

    const userIds = {};
    for (const u of [...shopUsers, ...dealerUsers]) {
      const { rows } = await client.query(
        `INSERT INTO users (dealer_id, role, name, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [u.dealerId || null, u.role, u.name, u.email, u.phone, passwordHash]
      );
      userIds[u.email] = rows[0].id;
    }

    const tech1 = userIds['tech1@reconos.dev'];
    const tech2 = userIds['tech2@reconos.dev'];
    const advisor = userIds['advisor@reconos.dev'];
    const metroManager = userIds['manager@metroauto.dev'];

    const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

    async function createVehicle(dealerId, vin, year, make, model, trim, stockNumber, color, odometer) {
      const { rows } = await client.query(
        `INSERT INTO vehicles (dealer_id, vin, year, make, model, trim, stock_number, color, odometer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [dealerId, vin, year, make, model, trim, stockNumber, color, odometer]
      );
      return rows[0].id;
    }

    async function createRO(vehicleId, dealerId, status, createdHoursAgo, promisedAt) {
      const { rows } = await client.query(
        `INSERT INTO recon_orders (vehicle_id, dealer_id, status, created_at, promised_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [vehicleId, dealerId, status, hoursAgo(createdHoursAgo), promisedAt]
      );
      return rows[0].id;
    }

    async function createLine(roId, opts) {
      const {
        title,
        description = null,
        laborHours = 0,
        laborRateCents = 0,
        partsCostCents = 0,
        partsPriceCents = 0,
        stage = 'inspection',
        approvalStatus = 'pending',
        techId = null,
        blockedReason = null,
        stageEnteredHoursAgo = 1,
        approvedByUserId = null,
      } = opts;
      const totalPriceCents = Math.round(laborHours * laborRateCents) + partsPriceCents;
      const { rows } = await client.query(
        `INSERT INTO ro_lines (ro_id, title, description, labor_hours, labor_rate_cents, parts_cost_cents, parts_price_cents,
                                total_price_cents, stage, approval_status, tech_id, blocked_reason, stage_entered_at,
                                approved_by_user_id, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          roId,
          title,
          description,
          laborHours,
          laborRateCents,
          partsCostCents,
          partsPriceCents,
          totalPriceCents,
          stage,
          approvalStatus,
          techId,
          blockedReason,
          hoursAgo(stageEnteredHoursAgo),
          approvedByUserId,
          approvalStatus === 'approved' ? hoursAgo(stageEnteredHoursAgo) : null,
        ]
      );
      const lineId = rows[0].id;
      await client.query(
        `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, created_at) VALUES ($1, NULL, $2, $3, $4)`,
        [lineId, stage, advisor, hoursAgo(stageEnteredHoursAgo)]
      );
      return lineId;
    }

    console.log('Creating vehicles + recon orders across pipeline stages...');

    // 1. Metro — fresh intake, no lines beyond inspection queue
    const v1 = await createVehicle(metro.id, '1FTFW1ET5DFC10312', 2021, 'Ford', 'F-150', 'XLT', 'MA-1001', 'Silver', 42000);
    const ro1 = await createRO(v1, metro.id, 'intake', 2, null);
    await createLine(ro1, { title: 'Initial inspection', stage: 'inspection', stageEnteredHoursAgo: 2 });

    // 2. Metro — inspection completed with findings, no estimate yet
    const v2 = await createVehicle(metro.id, '3GNAXUEV5LL123456', 2020, 'Chevrolet', 'Equinox', 'LT', 'MA-1002', 'White', 55000);
    const ro2 = await createRO(v2, metro.id, 'inspection', 30, null);
    await createLine(ro2, { title: 'Front bumper scuff', stage: 'inspection', stageEnteredHoursAgo: 30 });
    await client.query(
      `INSERT INTO inspections (ro_id, tech_id, checklist, findings, completed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$5)`,
      [
        ro2,
        tech1,
        JSON.stringify([
          { item: 'Exterior walk-around', passed: true },
          { item: 'Brakes', passed: true },
          { item: 'Tires', passed: false },
        ]),
        JSON.stringify([
          { title: 'Front bumper scuff', severity: 'minor', photos: [] },
          { title: 'Rear tire wear', severity: 'moderate', photos: [] },
        ]),
        hoursAgo(28),
      ]
    );
    await client.query(
      `INSERT INTO documents (vehicle_id, dealer_id, type, ref_id, title, created_at)
       SELECT $1, $2, 'inspection', i.id, 'Inspection report', $3 FROM inspections i WHERE i.ro_id = $4`,
      [v2, metro.id, hoursAgo(28), ro2]
    );

    // 3. Metro — estimate sent, both lines pending approval (>24h, shows red)
    const v3 = await createVehicle(metro.id, '1HGCV1F34LA012345', 2022, 'Honda', 'Accord', 'Sport', 'MA-1003', 'Black', 18000);
    const ro3 = await createRO(v3, metro.id, 'pending_approval', 40, '2026-09-11');
    const l3a = await createLine(ro3, {
      title: 'Windshield replacement',
      laborHours: 1.5,
      laborRateCents: 13500,
      partsCostCents: 22000,
      partsPriceCents: 28600,
      stage: 'approval',
      approvalStatus: 'pending',
      stageEnteredHoursAgo: 26,
    });
    const l3b = await createLine(ro3, {
      title: 'Interior detail',
      laborHours: 3,
      laborRateCents: 13500,
      stage: 'approval',
      approvalStatus: 'pending',
      stageEnteredHoursAgo: 26,
    });
    await client.query(
      `INSERT INTO estimate_snapshots (ro_id, version, snapshot, kind, created_by_user_id, created_at)
       VALUES ($1, 1, $2, 'sent', $3, $4)`,
      [
        ro3,
        JSON.stringify({
          lines: [
            { id: l3a, title: 'Windshield replacement', totalPriceCents: Math.round(1.5 * 13500) + 28600 },
            { id: l3b, title: 'Interior detail', totalPriceCents: Math.round(3 * 13500) },
          ],
        }),
        advisor,
        hoursAgo(26),
      ]
    );
    await client.query(
      `INSERT INTO documents (vehicle_id, dealer_id, type, ref_id, title, created_at)
       SELECT $1, $2, 'estimate', es.id, 'Original estimate', $3 FROM estimate_snapshots es WHERE es.ro_id = $4`,
      [v3, metro.id, hoursAgo(26), ro3]
    );

    // 4. Metro — partial approval: one approved+in progress, one declined (comeback), one still pending
    const v4 = await createVehicle(metro.id, '5YJ3E1EA1KF012345', 2019, 'Tesla', 'Model 3', 'Long Range', 'MA-1004', 'Blue', 31000);
    const ro4 = await createRO(v4, metro.id, 'active', 50, '2026-09-12');
    await createLine(ro4, {
      title: 'Brake pad replacement',
      laborHours: 2,
      laborRateCents: 13500,
      partsCostCents: 9000,
      partsPriceCents: 11700,
      stage: 'mechanical',
      approvalStatus: 'approved',
      techId: tech2,
      stageEnteredHoursAgo: 10,
      approvedByUserId: metroManager,
    });
    await createLine(ro4, {
      title: 'Aftermarket spoiler install',
      laborHours: 4,
      laborRateCents: 13500,
      stage: 'approval',
      approvalStatus: 'declined',
      stageEnteredHoursAgo: 20,
    });
    await createLine(ro4, {
      title: 'Paint correction — hood',
      laborHours: 5,
      laborRateCents: 13500,
      stage: 'approval',
      approvalStatus: 'pending',
      stageEnteredHoursAgo: 20,
    });

    // 5. Grid Auto Sales (internal) — blocked on parts, >48h (red)
    const v5 = await createVehicle(grid.id, '2T1BURHE0JC012345', 2018, 'Toyota', 'Corolla', 'LE', 'GA-2001', 'Gray', 61000);
    const ro5 = await createRO(v5, grid.id, 'active', 60, '2026-09-14');
    await createLine(ro5, {
      title: 'Alternator replacement',
      laborHours: 2.5,
      laborRateCents: 9500,
      partsCostCents: 18000,
      partsPriceCents: 20700,
      stage: 'parts',
      approvalStatus: 'approved',
      techId: tech1,
      blockedReason: 'parts',
      stageEnteredHoursAgo: 52,
      approvedByUserId: userIds['manager@gridauto.dev'],
    });

    // 6. Grid Auto Sales — mid pipeline, body/paint
    const v6 = await createVehicle(grid.id, 'JTDKN3DU0D1012345', 2020, 'Toyota', 'Prius', 'Two', 'GA-2002', 'Red', 39000);
    const ro6 = await createRO(v6, grid.id, 'active', 20, '2026-09-10');
    await createLine(ro6, {
      title: 'Door ding repair + repaint',
      laborHours: 6,
      laborRateCents: 9500,
      partsCostCents: 4000,
      partsPriceCents: 4600,
      stage: 'body_paint',
      approvalStatus: 'approved',
      techId: tech2,
      stageEnteredHoursAgo: 8,
      approvedByUserId: userIds['manager@gridauto.dev'],
    });

    // 7. Metro — in QC
    const v7 = await createVehicle(metro.id, '1G1ZD5ST3JF012345', 2018, 'Chevrolet', 'Malibu', 'LT', 'MA-1005', 'White', 48000);
    const ro7 = await createRO(v7, metro.id, 'qc', 15, '2026-09-09');
    await createLine(ro7, {
      title: 'Full detail + QC pass',
      laborHours: 3,
      laborRateCents: 13500,
      stage: 'qc',
      approvalStatus: 'approved',
      techId: tech1,
      stageEnteredHoursAgo: 3,
      approvedByUserId: metroManager,
    });

    // 8. Metro — ready for pickup
    const v8 = await createVehicle(metro.id, '3FA6P0H74HR012345', 2017, 'Ford', 'Fusion', 'SE', 'MA-1006', 'Black', 72000);
    const ro8 = await createRO(v8, metro.id, 'ready', 45, '2026-09-08');
    await createLine(ro8, {
      title: 'Full recon complete',
      laborHours: 8,
      laborRateCents: 13500,
      stage: 'ready',
      approvalStatus: 'approved',
      techId: tech2,
      stageEnteredHoursAgo: 4,
      approvedByUserId: metroManager,
    });

    console.log('Seeding default alert preferences for dealer users...');
    const eventTypes = [
      'estimate_ready',
      'approval_needed',
      'approval_reminder',
      'promise_date_changed',
      'qc_passed',
      'ready_for_pickup',
      'invoice_sent',
    ];
    for (const u of dealerUsers) {
      const uid = userIds[u.email];
      for (const eventType of eventTypes) {
        for (const channel of ['sms', 'email']) {
          await client.query(
            `INSERT INTO alert_prefs (user_id, event_type, channel, enabled) VALUES ($1,$2,$3,TRUE)
             ON CONFLICT (user_id, event_type, channel) DO NOTHING`,
            [uid, eventType, channel]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('\nSeed complete.');
    console.log(`All users share the password: ${DEFAULT_PASSWORD}`);
    console.log('Shop logins: owner@reconos.dev, advisor@reconos.dev, tech1@reconos.dev, tech2@reconos.dev');
    console.log('Metro Auto Group logins: manager@metroauto.dev, viewer@metroauto.dev, billing@metroauto.dev');
    console.log('Grid Auto Sales (internal) logins: manager@gridauto.dev, viewer@gridauto.dev');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
