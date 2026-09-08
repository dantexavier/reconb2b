const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const { dealerId } = req.query;
  const params = [];
  let where = '';

  if (isDealerUser(req.user)) {
    params.push(req.user.dealer_id);
    where = `WHERE i.dealer_id = $1`;
  } else if (dealerId) {
    params.push(dealerId);
    where = `WHERE i.dealer_id = $1`;
  }

  const { rows } = await query(
    `SELECT i.*, v.year, v.make, v.model, v.stock_number
     FROM invoices i
     JOIN recon_orders r ON r.id = i.ro_id
     JOIN vehicles v ON v.id = r.vehicle_id
     ${where}
     ORDER BY i.created_at DESC`,
    params
  );
  return ok(res, { invoices: rows });
});
