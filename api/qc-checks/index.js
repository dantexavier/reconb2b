const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, created, notFound, badRequest, forbidden, methodNotAllowed } = require('../_lib/http');
const { notify } = require('../_lib/notify');

module.exports = withAuth(async (req, res) => {
  if (isDealerUser(req.user)) return forbidden(res, 'Not permitted');
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { roLineId } = req.query;
  const params = [];
  let where = '';
  if (roLineId) {
    params.push(roLineId);
    where = 'WHERE ro_line_id = $1';
  }
  const { rows } = await query(`SELECT * FROM qc_checks ${where} ORDER BY created_at DESC`, params);
  return ok(res, { qcChecks: rows });
}

async function handleCreate(req, res) {
  const b = req.body || {};
  if (!b.roLineId || typeof b.passed !== 'boolean') return badRequest(res, 'roLineId and passed (boolean) are required');

  const { rows: lineRows } = await query(
    `SELECT rl.*, r.dealer_id, v.year, v.make, v.model, v.stock_number
     FROM ro_lines rl
     JOIN recon_orders r ON r.id = rl.ro_id
     JOIN vehicles v ON v.id = r.vehicle_id
     WHERE rl.id = $1`,
    [b.roLineId]
  );
  const line = lineRows[0];
  if (!line) return notFound(res, 'Line not found');
  if (req.user.role === 'tech' && line.tech_id !== req.user.id) {
    return forbidden(res, 'Techs can only QC their own assigned lines');
  }
  if (line.stage !== 'qc') return badRequest(res, 'Line is not in the QC stage');

  const { rows } = await query(
    `INSERT INTO qc_checks (ro_line_id, checklist, passed, notes, checked_by_user_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.roLineId, JSON.stringify(b.checklist || []), b.passed, b.notes || null, req.user.id]
  );
  const qcCheck = rows[0];

  if (b.passed) {
    await query(`UPDATE ro_lines SET stage = 'ready', stage_entered_at = now() WHERE id = $1`, [b.roLineId]);
    await query(
      `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note) VALUES ($1,'qc','ready',$2,'QC passed')`,
      [b.roLineId, req.user.id]
    );

    const vehicleLabel = [line.year, line.make, line.model].filter(Boolean).join(' ') || line.stock_number;
    await notify('qc_passed', { dealerId: line.dealer_id, vehicleLabel }, req.user);

    const { rows: remaining } = await query(
      `SELECT COUNT(*) AS c FROM ro_lines WHERE ro_id = $1 AND stage != 'ready' AND approval_status != 'declined'`,
      [line.ro_id]
    );
    if (Number(remaining[0].c) === 0) {
      await query(`UPDATE recon_orders SET status = 'ready' WHERE id = $1 AND status != 'ready'`, [line.ro_id]);
      await notify('ready_for_pickup', { dealerId: line.dealer_id, vehicleLabel }, req.user);
    }
  } else {
    await query(
      `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note) VALUES ($1,'qc','qc',$2,'QC failed')`,
      [b.roLineId, req.user.id]
    );
  }

  return created(res, { qcCheck });
}
