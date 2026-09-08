const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, badRequest, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') {
    const { rows } = await query(`SELECT key, value FROM settings`);
    return ok(res, { settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }

  if (req.method === 'PUT') {
    if (req.user.role !== 'owner') return badRequest(res, 'Only owner can change settings');
    const updates = req.body || {};
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify(value)]
      );
    }
    const { rows } = await query(`SELECT key, value FROM settings`);
    return ok(res, { settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
});
