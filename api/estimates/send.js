const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, notFound, badRequest, methodNotAllowed } = require('../_lib/http');
const { getNextSentVersion, writeSnapshot } = require('../_lib/estimateSnapshot');
const { addDocument } = require('../_lib/documents');
const { notify } = require('../_lib/notify');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (req.user.role === 'tech') return badRequest(res, 'Not permitted');

  const { roId } = req.body || {};
  if (!roId) return badRequest(res, 'roId is required');

  const { rows: roRows } = await query(
    `SELECT r.*, v.id AS vehicle_id, v.year, v.make, v.model, v.stock_number
     FROM recon_orders r JOIN vehicles v ON v.id = r.vehicle_id WHERE r.id = $1`,
    [roId]
  );
  const ro = roRows[0];
  if (!ro) return notFound(res);

  const { rows: pendingLines } = await query(
    `SELECT id FROM ro_lines WHERE ro_id = $1 AND approval_status = 'pending'`,
    [roId]
  );
  if (pendingLines.length === 0) return badRequest(res, 'No pending lines to send for approval');

  const version = await getNextSentVersion(roId);
  const snapshot = await writeSnapshot({ roId, version, kind: 'sent', actorUserId: req.user.id });

  await query(
    `UPDATE ro_lines SET stage = 'approval', stage_entered_at = now()
     WHERE ro_id = $1 AND approval_status = 'pending' AND stage != 'approval'`,
    [roId]
  );
  await query(
    `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note)
     SELECT id, stage, 'approval', $1, 'Estimate sent for approval'
     FROM ro_lines WHERE ro_id = $2 AND approval_status = 'pending'`,
    [req.user.id, roId]
  );

  await query(
    `UPDATE recon_orders SET status = 'pending_approval' WHERE id = $1 AND status IN ('intake', 'inspection')`,
    [roId]
  );

  await addDocument({
    vehicleId: ro.vehicle_id,
    dealerId: ro.dealer_id,
    type: 'estimate',
    refId: snapshot.id,
    title: version === 1 ? 'Original estimate' : `Revised estimate v${version}`,
  });

  const vehicleLabel = [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number;
  await notify('estimate_ready', { dealerId: ro.dealer_id, vehicleLabel }, req.user);
  await notify('approval_needed', { dealerId: ro.dealer_id, vehicleLabel, lineCount: pendingLines.length }, req.user);

  return ok(res, { snapshot });
});
