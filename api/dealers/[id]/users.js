const { query } = require('../../_lib/db');
const { withAuth, SHOP_ROLES, DEALER_ROLES, hashPassword } = require('../../_lib/auth');
const { ok, created, badRequest, methodNotAllowed } = require('../../_lib/http');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT id, dealer_id, role, name, email, phone, active, created_at
       FROM users WHERE dealer_id = $1 ORDER BY name ASC`,
      [id]
    );
    return ok(res, { users: rows });
  }

  if (req.method === 'POST') {
    if (req.user.role === 'tech') return badRequest(res, 'Not permitted');
    const b = req.body || {};
    if (!b.name || !b.email || !b.password || !b.role) {
      return badRequest(res, 'name, email, password, role are required');
    }
    if (!DEALER_ROLES.includes(b.role)) return badRequest(res, `role must be one of ${DEALER_ROLES.join(', ')}`);

    const passwordHash = await hashPassword(b.password);
    const { rows } = await query(
      `INSERT INTO users (dealer_id, role, name, email, phone, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, dealer_id, role, name, email, phone, active, created_at`,
      [id, b.role, b.name, String(b.email).toLowerCase().trim(), b.phone || null, passwordHash]
    );
    return created(res, { user: rows[0] });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
});
