const { query } = require('../_lib/db');
const { withAuth, isDealerUser, SHOP_ROLES } = require('../_lib/auth');
const { ok, notFound, badRequest, forbidden, methodNotAllowed } = require('../_lib/http');
const { recalcPromiseDate } = require('../_lib/promiseDate');

const STATUSES = ['ordered', 'received', 'installed'];

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  if (isDealerUser(req.user) || req.user.role === 'tech') return forbidden(res, 'Not permitted');

  const { id } = req.query;
  const { rows } = await query(
    `SELECT po.*, rl.ro_id, rl.blocked_reason FROM parts_orders po JOIN ro_lines rl ON rl.id = po.ro_line_id WHERE po.id = $1`,
    [id]
  );
  const existing = rows[0];
  if (!existing) return notFound(res);

  const b = req.body || {};
  if (b.status && !STATUSES.includes(b.status)) return badRequest(res, `status must be one of ${STATUSES.join(', ')}`);

  const next = {
    vendor: b.vendor !== undefined ? b.vendor : existing.vendor,
    description: b.description !== undefined ? b.description : existing.description,
    cost_cents: b.costCents !== undefined ? b.costCents : existing.cost_cents,
    eta_date: b.etaDate !== undefined ? b.etaDate : existing.eta_date,
    status: b.status !== undefined ? b.status : existing.status,
    bin_location: b.binLocation !== undefined ? b.binLocation : existing.bin_location,
  };

  const { rows: updatedRows } = await query(
    `UPDATE parts_orders SET vendor=$1, description=$2, cost_cents=$3, eta_date=$4, status=$5, bin_location=$6
     WHERE id=$7 RETURNING *`,
    [next.vendor, next.description, next.cost_cents, next.eta_date, next.status, next.bin_location, id]
  );

  // If every parts order on this line is now received/installed, the line
  // is no longer blocked on parts.
  if (existing.blocked_reason === 'parts') {
    const { rows: openOrders } = await query(
      `SELECT 1 FROM parts_orders WHERE ro_line_id = $1 AND status = 'ordered' LIMIT 1`,
      [existing.ro_line_id]
    );
    if (openOrders.length === 0) {
      await query(`UPDATE ro_lines SET blocked_reason = NULL WHERE id = $1`, [existing.ro_line_id]);
    }
  }

  await recalcPromiseDate(existing.ro_id, req.user);

  return ok(res, { partsOrder: updatedRows[0] });
});
