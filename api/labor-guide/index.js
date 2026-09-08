const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, created, badRequest, methodNotAllowed } = require('../_lib/http');

const CATEGORIES = ['mechanical', 'body_paint', 'detail', 'glass', 'electrical', 'custom'];

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { includeInactive } = req.query;
  const where = includeInactive === 'true' ? '' : 'WHERE active = TRUE';
  const { rows } = await query(`SELECT * FROM labor_guide_items ${where} ORDER BY category ASC, title ASC`);
  return ok(res, { items: rows });
}

async function handleCreate(req, res) {
  if (req.user.role === 'tech') return badRequest(res, 'Not permitted');
  const b = req.body || {};
  if (!b.title) return badRequest(res, 'title is required');
  if (b.category && !CATEGORIES.includes(b.category)) return badRequest(res, `category must be one of ${CATEGORIES.join(', ')}`);

  const { rows } = await query(
    `INSERT INTO labor_guide_items (title, category, default_labor_hours, default_parts_cost_cents, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.title, b.category || 'custom', b.defaultLaborHours || 0, b.defaultPartsCostCents || 0, b.description || null]
  );
  return created(res, { item: rows[0] });
}
