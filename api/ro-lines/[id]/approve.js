const { query } = require('../../_lib/db');
const { withAuth, isDealerUser } = require('../../_lib/auth');
const { ok, notFound, forbidden, badRequest, methodNotAllowed } = require('../../_lib/http');
const { recalcPromiseDate } = require('../../_lib/promiseDate');
const { getLatestSentVersion, writeSnapshot } = require('../../_lib/estimateSnapshot');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!isDealerUser(req.user) || req.user.role !== 'manager') {
    return forbidden(res, 'Only dealer managers can approve lines');
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

  const nextStage = line.parts_cost_cents > 0 ? 'parts' : 'mechanical';

  const { rows: updatedRows } = await query(
    `UPDATE ro_lines SET approval_status = 'approved', approved_by_user_id = $1, approved_at = now(),
                          stage = $2, stage_entered_at = now(), blocked_reason = NULL
     WHERE id = $3 RETURNING *`,
    [req.user.id, nextStage, id]
  );

  await query(
    `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note) VALUES ($1,$2,$3,$4,'Dealer approved')`,
    [id, line.stage, nextStage, req.user.id]
  );

  const version = await getLatestSentVersion(line.ro_id);
  await writeSnapshot({ roId: line.ro_id, version, kind: 'approved', actorUserId: req.user.id });

  // Partial approval releases work immediately — the RO moves out of
  // pending_approval as soon as any line is approved, without waiting for
  // the dealer to decide on the rest.
  await query(`UPDATE recon_orders SET status = 'active' WHERE id = $1 AND status = 'pending_approval'`, [line.ro_id]);
  await recalcPromiseDate(line.ro_id, req.user);

  return ok(res, { line: updatedRows[0] });
});
