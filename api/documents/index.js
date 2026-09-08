const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const { type, from, to, q, vehicleId, dealerId } = req.query;
  const params = [];
  const clauses = [];

  if (isDealerUser(req.user)) {
    params.push(req.user.dealer_id);
    clauses.push(`d.dealer_id = $${params.length}`);
  } else if (dealerId) {
    params.push(dealerId);
    clauses.push(`d.dealer_id = $${params.length}`);
  }

  if (type) {
    params.push(type);
    clauses.push(`d.type = $${params.length}`);
  }
  if (vehicleId) {
    params.push(vehicleId);
    clauses.push(`d.vehicle_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`d.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`d.created_at <= $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toUpperCase()}%`);
    clauses.push(`(UPPER(v.vin) LIKE $${params.length} OR UPPER(v.stock_number) LIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT d.*, v.vin, v.stock_number, v.year, v.make, v.model
     FROM documents d
     JOIN vehicles v ON v.id = d.vehicle_id
     ${where}
     ORDER BY d.created_at DESC`,
    params
  );
  return ok(res, { documents: rows });
});
