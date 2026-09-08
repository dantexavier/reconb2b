const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, created, badRequest, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT id, name, contact_name, contact_email, contact_phone,
              secondary_contact_name, secondary_contact_email, secondary_contact_phone,
              payment_terms, priority_tier, labor_rate_cents, parts_markup_pct,
              is_internal, active, created_at
       FROM dealers ORDER BY name ASC`
    );
    return ok(res, { dealers: rows });
  }

  if (req.method === 'POST') {
    if (req.user.role === 'tech') return badRequest(res, 'Not permitted');
    const b = req.body || {};
    if (!b.name) return badRequest(res, 'name is required');
    const { rows } = await query(
      `INSERT INTO dealers
        (name, contact_name, contact_email, contact_phone,
         secondary_contact_name, secondary_contact_email, secondary_contact_phone,
         payment_terms, priority_tier, labor_rate_cents, parts_markup_pct, is_internal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        b.name,
        b.contactName || null,
        b.contactEmail || null,
        b.contactPhone || null,
        b.secondaryContactName || null,
        b.secondaryContactEmail || null,
        b.secondaryContactPhone || null,
        b.paymentTerms || 'net15',
        b.priorityTier || 'standard',
        b.laborRateCents != null ? b.laborRateCents : 12000,
        b.partsMarkupPct != null ? b.partsMarkupPct : 25.0,
        !!b.isInternal,
      ]
    );
    return created(res, { dealer: rows[0] });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
});
