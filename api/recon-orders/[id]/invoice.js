const { query } = require('../../_lib/db');
const { withAuth, SHOP_ROLES } = require('../../_lib/auth');
const { created, notFound, badRequest, methodNotAllowed } = require('../../_lib/http');
const { notify } = require('../../_lib/notify');
const { addDocument } = require('../../_lib/documents');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (req.user.role === 'tech') return badRequest(res, 'Not permitted');
  const { id } = req.query;

  const { rows: roRows } = await query(
    `SELECT r.*, v.id AS vehicle_id, v.year, v.make, v.model, v.stock_number
     FROM recon_orders r JOIN vehicles v ON v.id = r.vehicle_id WHERE r.id = $1`,
    [id]
  );
  const ro = roRows[0];
  if (!ro) return notFound(res);

  const { rows: totals } = await query(
    `SELECT COALESCE(SUM(total_price_cents), 0) AS subtotal
     FROM ro_lines WHERE ro_id = $1 AND approval_status = 'approved'`,
    [id]
  );
  const subtotalCents = Number(totals[0].subtotal);
  const taxCents = 0; // tax handling out of scope for Phase 1
  const totalCents = subtotalCents + taxCents;

  const { rows: invoiceRows } = await query(
    `INSERT INTO invoices (ro_id, dealer_id, subtotal_cents, tax_cents, total_cents, status, sent_at)
     VALUES ($1, $2, $3, $4, $5, 'sent', now()) RETURNING *`,
    [id, ro.dealer_id, subtotalCents, taxCents, totalCents]
  );
  const invoice = invoiceRows[0];

  await addDocument({ vehicleId: ro.vehicle_id, dealerId: ro.dealer_id, type: 'invoice', refId: invoice.id, title: `Invoice — ${ro.stock_number || ro.vehicle_id}` });

  await notify(
    'invoice_sent',
    { dealerId: ro.dealer_id, vehicleLabel: [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number },
    req.user
  );

  return created(res, { invoice });
});
