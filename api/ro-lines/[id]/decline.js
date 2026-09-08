const { query } = require('../../_lib/db');
const { withAuth, isDealerUser } = require('../../_lib/auth');
const { ok, notFound, forbidden, badRequest, methodNotAllowed } = require('../../_lib/http');
const { getLatestSentVersion, writeSnapshot } = require('../../_lib/estimateSnapshot');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!isDealerUser(req.user) || req.user.role !== 'manager') {
    return forbidden(res, 'Only dealer managers can decline lines');
  }

  const { id } = req.query;
  const { rows } = await query(
    `SELECT rl.*, r.dealer_id, r.id AS ro_id FROM ro_lines rl JOIN recon_orders r ON r.id = rl.ro_id WHERE rl.id = $1`,
    [id]
  );
  const line = rows[0];
  if (!line) return notFound(res);
  if (line.dealer_id !== req.user.dealer_id) return forbidden(res);
  if (line.approval_status !== 'pending') return badRequest(res, 'Line is not pending approval');

  // Declined lines persist on the vehicle record forever (comeback
  // documentation) — never deleted, just marked and left in place.
  const { rows: updatedRows } = await query(
    `UPDATE ro_lines SET approval_status = 'declined' WHERE id = $1 RETURNING *`,
    [id]
  );

  await query(
    `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note) VALUES ($1,$2,$2,$3,'Dealer declined')`,
    [id, line.stage, req.user.id]
  );

  const version = await getLatestSentVersion(line.ro_id);
  await writeSnapshot({ roId: line.ro_id, version, kind: 'approved', actorUserId: req.user.id });

  await query(`UPDATE recon_orders SET status = 'active' WHERE id = $1 AND status = 'pending_approval'`, [line.ro_id]);

  return ok(res, { line: updatedRows[0] });
});
