const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, notFound, badRequest, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { rows } = await query(`SELECT * FROM dealers WHERE id = $1`, [id]);
    if (!rows[0]) return notFound(res);
    return ok(res, { dealer: rows[0] });
  }

  if (req.method === 'PUT') {
    if (req.user.role === 'tech') return badRequest(res, 'Not permitted');
    const b = req.body || {};
    const { rows: existingRows } = await query(`SELECT * FROM dealers WHERE id = $1`, [id]);
    const existing = existingRows[0];
    if (!existing) return notFound(res);

    const merged = { ...existing, ...toSnakeCasePatch(b) };
    const { rows } = await query(
      `UPDATE dealers SET
        name = $1, contact_name = $2, contact_email = $3, contact_phone = $4,
        secondary_contact_name = $5, secondary_contact_email = $6, secondary_contact_phone = $7,
        payment_terms = $8, priority_tier = $9, labor_rate_cents = $10, parts_markup_pct = $11,
        is_internal = $12, active = $13
       WHERE id = $14 RETURNING *`,
      [
        merged.name,
        merged.contact_name,
        merged.contact_email,
        merged.contact_phone,
        merged.secondary_contact_name,
        merged.secondary_contact_email,
        merged.secondary_contact_phone,
        merged.payment_terms,
        merged.priority_tier,
        merged.labor_rate_cents,
        merged.parts_markup_pct,
        merged.is_internal,
        merged.active,
        id,
      ]
    );
    return ok(res, { dealer: rows[0] });
  }

  return methodNotAllowed(res, ['GET', 'PUT']);
});

function toSnakeCasePatch(b) {
  const map = {
    name: 'name',
    contactName: 'contact_name',
    contactEmail: 'contact_email',
    contactPhone: 'contact_phone',
    secondaryContactName: 'secondary_contact_name',
    secondaryContactEmail: 'secondary_contact_email',
    secondaryContactPhone: 'secondary_contact_phone',
    paymentTerms: 'payment_terms',
    priorityTier: 'priority_tier',
    laborRateCents: 'labor_rate_cents',
    partsMarkupPct: 'parts_markup_pct',
    isInternal: 'is_internal',
    active: 'active',
  };
  const out = {};
  for (const [k, v] of Object.entries(b)) {
    if (map[k]) out[map[k]] = v;
  }
  return out;
}
