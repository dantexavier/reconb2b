const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, notFound, forbidden, badRequest, methodNotAllowed } = require('../_lib/http');
const { notify } = require('../_lib/notify');

module.exports = withAuth(async (req, res) => {
  const { id } = req.query;

  const { rows: roRows } = await query(
    `SELECT r.*, v.vin, v.year, v.make, v.model, v.trim, v.stock_number, v.color, v.odometer, v.photos AS vehicle_photos,
            d.name AS dealer_name, d.labor_rate_cents AS dealer_labor_rate_cents, d.parts_markup_pct AS dealer_parts_markup_pct
     FROM recon_orders r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN dealers d ON d.id = r.dealer_id
     WHERE r.id = $1`,
    [id]
  );
  const ro = roRows[0];
  if (!ro) return notFound(res);
  if (isDealerUser(req.user) && ro.dealer_id !== req.user.dealer_id) return forbidden(res);

  if (req.method === 'GET') return handleGet(req, res, ro);
  if (req.method === 'PATCH') return handlePatch(req, res, ro);
  return methodNotAllowed(res, ['GET', 'PATCH']);
});

async function handleGet(req, res, ro) {
  const { rows: lines } = await query(
    `SELECT rl.*, u.name AS tech_name
     FROM ro_lines rl
     LEFT JOIN users u ON u.id = rl.tech_id
     WHERE rl.ro_id = $1
     ORDER BY rl.stage_entered_at ASC`,
    [ro.id]
  );

  const { rows: inspections } = await query(
    `SELECT i.*, u.name AS tech_name FROM inspections i LEFT JOIN users u ON u.id = i.tech_id WHERE i.ro_id = $1 ORDER BY i.created_at DESC`,
    [ro.id]
  );

  const { rows: snapshots } = await query(
    `SELECT id, ro_id, version, kind, created_at, created_by_user_id FROM estimate_snapshots WHERE ro_id = $1 ORDER BY version ASC, created_at ASC`,
    [ro.id]
  );

  const { rows: stageEvents } = await query(
    `SELECT se.*, u.name AS user_name FROM stage_events se
     LEFT JOIN users u ON u.id = se.user_id
     JOIN ro_lines rl ON rl.id = se.ro_line_id
     WHERE rl.ro_id = $1
     ORDER BY se.created_at ASC`,
    [ro.id]
  );

  const { rows: invoices } = await query(`SELECT * FROM invoices WHERE ro_id = $1 ORDER BY created_at DESC`, [ro.id]);

  const { rows: partsOrders } = await query(
    `SELECT po.* FROM parts_orders po JOIN ro_lines rl ON rl.id = po.ro_line_id WHERE rl.ro_id = $1 ORDER BY po.created_at DESC`,
    [ro.id]
  );

  const { rows: qcChecks } = await query(
    `SELECT qc.*, u.name AS checked_by_name FROM qc_checks qc
     JOIN ro_lines rl ON rl.id = qc.ro_line_id
     LEFT JOIN users u ON u.id = qc.checked_by_user_id
     WHERE rl.ro_id = $1 ORDER BY qc.created_at DESC`,
    [ro.id]
  );

  // Comeback documentation: declined lines from any prior RO for the same VIN.
  const { rows: comebackLines } = await query(
    `SELECT rl.id, rl.title, rl.description, rl.stage, rl.created_at, r.id AS ro_id
     FROM ro_lines rl
     JOIN recon_orders r ON r.id = rl.ro_id
     JOIN vehicles v ON v.id = r.vehicle_id
     WHERE v.vin = $1 AND rl.approval_status = 'declined' AND r.id != $2
     ORDER BY rl.created_at DESC`,
    [ro.vin, ro.id]
  );

  return ok(res, { reconOrder: ro, lines, inspections, snapshots, stageEvents, invoices, comebackLines, partsOrders, qcChecks });
}

async function handlePatch(req, res, ro) {
  if (isDealerUser(req.user)) return forbidden(res);
  const b = req.body || {};
  const validStatuses = ['intake', 'inspection', 'pending_approval', 'active', 'qc', 'ready', 'delivered', 'closed'];
  if (b.status && !validStatuses.includes(b.status)) return badRequest(res, 'Invalid status');

  const nextStatus = b.status || ro.status;
  const deliveredAt = nextStatus === 'delivered' && ro.status !== 'delivered' ? new Date() : ro.delivered_at;

  const { rows } = await query(
    `UPDATE recon_orders SET status = $1, delivered_at = $2 WHERE id = $3 RETURNING *`,
    [nextStatus, deliveredAt, ro.id]
  );

  if (nextStatus === 'ready' && ro.status !== 'ready') {
    await notify(
      'ready_for_pickup',
      { dealerId: ro.dealer_id, vehicleLabel: [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number },
      req.user
    );
  }

  return ok(res, { reconOrder: rows[0] });
}
