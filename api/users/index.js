const { query } = require('../_lib/db');
const { withAuth, hashPassword, SHOP_ROLES } = require('../_lib/auth');
const { ok, created, badRequest, forbidden, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT id, role, name, email, phone, active, created_at
       FROM users WHERE dealer_id IS NULL ORDER BY name ASC`
    );
    return ok(res, { users: rows });
  }

  if (req.method === 'POST') {
    if (req.user.role !== 'owner') return forbidden(res, 'Only owner can create shop users');
    const b = req.body || {};
    if (!b.name || !b.email || !b.password || !b.role) {
      return badRequest(res, 'name, email, password, role are required');
    }
    if (!SHOP_ROLES.includes(b.role)) return badRequest(res, `role must be one of ${SHOP_ROLES.join(', ')}`);

    const passwordHash = await hashPassword(b.password);
    const { rows } = await query(
      `INSERT INTO users (dealer_id, role, name, email, phone, password_hash)
       VALUES (NULL, $1,$2,$3,$4,$5)
       RETURNING id, role, name, email, phone, active, created_at`,
      [b.role, b.name, String(b.email).toLowerCase().trim(), b.phone || null, passwordHash]
    );
    return created(res, { user: rows[0] });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
});
