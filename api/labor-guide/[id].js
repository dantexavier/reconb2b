const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, notFound, badRequest, methodNotAllowed } = require('../_lib/http');

const CATEGORIES = ['mechanical', 'body_paint', 'detail', 'glass', 'electrical', 'custom'];

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method !== 'PUT') return methodNotAllowed(res, ['PUT']);
  if (req.user.role === 'tech') return badRequest(res, 'Not permitted');

  const { id } = req.query;
  const { rows: existingRows } = await query(`SELECT * FROM labor_guide_items WHERE id = $1`, [id]);
  const existing = existingRows[0];
  if (!existing) return notFound(res);

  const b = req.body || {};
  if (b.category && !CATEGORIES.includes(b.category)) return badRequest(res, `category must be one of ${CATEGORIES.join(', ')}`);

  const next = {
    title: b.title !== undefined ? b.title : existing.title,
    category: b.category !== undefined ? b.category : existing.category,
    default_labor_hours: b.defaultLaborHours !== undefined ? b.defaultLaborHours : existing.default_labor_hours,
    default_parts_cost_cents: b.defaultPartsCostCents !== undefined ? b.defaultPartsCostCents : existing.default_parts_cost_cents,
    description: b.description !== undefined ? b.description : existing.description,
    active: b.active !== undefined ? b.active : existing.active,
  };

  const { rows } = await query(
    `UPDATE labor_guide_items SET title=$1, category=$2, default_labor_hours=$3, default_parts_cost_cents=$4, description=$5, active=$6
     WHERE id=$7 RETURNING *`,
    [next.title, next.category, next.default_labor_hours, next.default_parts_cost_cents, next.description, next.active, id]
  );
  return ok(res, { item: rows[0] });
});
