const { query, withTransaction } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, created, badRequest, forbidden, methodNotAllowed } = require('../_lib/http');
const { recalcPromiseDate } = require('../_lib/promiseDate');

module.exports = withAuth(async (req, res) => {
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { dealerId, status } = req.query;
  const params = [];
  const clauses = [];

  if (isDealerUser(req.user)) {
    params.push(req.user.dealer_id);
    clauses.push(`r.dealer_id = $${params.length}`);
  } else if (dealerId) {
    params.push(dealerId);
    clauses.push(`r.dealer_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    clauses.push(`r.status = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT r.*, v.vin, v.year, v.make, v.model, v.trim, v.stock_number, v.color, v.odometer, v.photos,
            d.name AS dealer_name,
            (SELECT COUNT(*) FROM ro_lines rl WHERE rl.ro_id = r.id AND rl.approval_status = 'pending') AS pending_line_count,
            (SELECT MIN(rl.stage_entered_at) FROM ro_lines rl WHERE rl.ro_id = r.id AND rl.stage != 'ready') AS oldest_stage_entered_at,
            (SELECT COALESCE(SUM(rl.total_price_cents), 0) FROM ro_lines rl WHERE rl.ro_id = r.id AND rl.approval_status = 'approved') AS approved_total_cents
     FROM recon_orders r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN dealers d ON d.id = r.dealer_id
     ${where}
     ORDER BY oldest_stage_entered_at ASC NULLS LAST, r.created_at ASC`,
    params
  );
  return ok(res, { reconOrders: rows });
}

async function handleCreate(req, res) {
  if (isDealerUser(req.user)) return forbidden(res, 'Dealer users cannot create intakes');
  const b = req.body || {};
  if (!b.dealerId || !b.vin) return badRequest(res, 'dealerId and vin are required');

  const vin = String(b.vin).toUpperCase().trim();
  const lines = Array.isArray(b.lines) ? b.lines : [];

  const result = await withTransaction(async (client) => {
    const { rows: existingVehicleRows } = await client.query(
      `SELECT id FROM vehicles WHERE dealer_id = $1 AND vin = $2 LIMIT 1`,
      [b.dealerId, vin]
    );

    let vehicleId;
    if (existingVehicleRows[0]) {
      vehicleId = existingVehicleRows[0].id;
      await client.query(
        `UPDATE vehicles SET year=$1, make=$2, model=$3, trim=$4, stock_number=$5, color=$6, odometer=$7, photos=$8
         WHERE id = $9`,
        [
          b.year || null,
          b.make || null,
          b.model || null,
          b.trim || null,
          b.stockNumber || null,
          b.color || null,
          b.odometer || null,
          JSON.stringify(b.photos || []),
          vehicleId,
        ]
      );
    } else {
      const { rows: vehicleRows } = await client.query(
        `INSERT INTO vehicles (dealer_id, vin, year, make, model, trim, stock_number, color, odometer, photos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          b.dealerId,
          vin,
          b.year || null,
          b.make || null,
          b.model || null,
          b.trim || null,
          b.stockNumber || null,
          b.color || null,
          b.odometer || null,
          JSON.stringify(b.photos || []),
        ]
      );
      vehicleId = vehicleRows[0].id;
    }

    const { rows: roRows } = await client.query(
      `INSERT INTO recon_orders (vehicle_id, dealer_id, status) VALUES ($1, $2, 'intake') RETURNING *`,
      [vehicleId, b.dealerId]
    );
    const ro = roRows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO ro_lines (ro_id, title, description, labor_hours, labor_rate_cents, parts_cost_cents, parts_price_cents, total_price_cents, stage, labor_guide_item_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'inspection',$9)`,
        [
          ro.id,
          line.title || 'Untitled line',
          line.description || null,
          line.laborHours || 0,
          line.laborRateCents || 0,
          line.partsCostCents || 0,
          line.partsPriceCents || 0,
          computeLineTotal(line),
          line.laborGuideItemId || null,
        ]
      );
    }

    await client.query(
      `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note)
       SELECT id, NULL, 'inspection', $1, 'Intake created' FROM ro_lines WHERE ro_id = $2`,
      [req.user.id, ro.id]
    );

    return { vehicleId, ro };
  });

  const promisedAt = await recalcPromiseDate(result.ro.id, req.user);

  return created(res, { reconOrder: { ...result.ro, promised_at: promisedAt } });
}

function computeLineTotal(line) {
  const laborCents = Math.round((line.laborHours || 0) * (line.laborRateCents || 0));
  return laborCents + (line.partsPriceCents || 0);
}
