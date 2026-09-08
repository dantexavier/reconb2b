const { query } = require('../_lib/db');
const { withAuth, isDealerUser, SHOP_ROLES } = require('../_lib/auth');
const { ok, created, badRequest, forbidden, notFound, methodNotAllowed } = require('../_lib/http');
const { recalcPromiseDate } = require('../_lib/promiseDate');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { roLineId, roId } = req.query;
  const params = [];
  const clauses = [];
  if (roLineId) {
    params.push(roLineId);
    clauses.push(`po.ro_line_id = $${params.length}`);
  }
  if (roId) {
    params.push(roId);
    clauses.push(`rl.ro_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT po.* FROM parts_orders po JOIN ro_lines rl ON rl.id = po.ro_line_id ${where} ORDER BY po.created_at DESC`,
    params
  );
  return ok(res, { partsOrders: rows });
}

async function handleCreate(req, res) {
  if (isDealerUser(req.user) || req.user.role === 'tech') return forbidden(res, 'Not permitted');
  const b = req.body || {};
  if (!b.roLineId) return badRequest(res, 'roLineId is required');

  const { rows: lineRows } = await query(`SELECT id, ro_id, blocked_reason FROM ro_lines WHERE id = $1`, [b.roLineId]);
  const line = lineRows[0];
  if (!line) return notFound(res, 'Line not found');

  const { rows } = await query(
    `INSERT INTO parts_orders (ro_line_id, vendor, description, cost_cents, eta_date, bin_location)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.roLineId, b.vendor || null, b.description || null, b.costCents || 0, b.etaDate || null, b.binLocation || null]
  );

  if (!line.blocked_reason) {
    await query(`UPDATE ro_lines SET blocked_reason = 'parts' WHERE id = $1`, [line.id]);
  }
  await recalcPromiseDate(line.ro_id, req.user);

  return created(res, { partsOrder: rows[0] });
}
