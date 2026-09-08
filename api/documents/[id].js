const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, notFound, forbidden, methodNotAllowed } = require('../_lib/http');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const { id } = req.query;

  const { rows } = await query(`SELECT * FROM documents WHERE id = $1`, [id]);
  const doc = rows[0];
  if (!doc) return notFound(res);
  if (isDealerUser(req.user) && doc.dealer_id !== req.user.dealer_id) return forbidden(res);

  let content = null;
  if (doc.type === 'estimate') {
    const { rows: snap } = await query(`SELECT * FROM estimate_snapshots WHERE id = $1`, [doc.ref_id]);
    content = snap[0] || null;
  } else if (doc.type === 'inspection') {
    const { rows: insp } = await query(`SELECT * FROM inspections WHERE id = $1`, [doc.ref_id]);
    content = insp[0] || null;
  } else if (doc.type === 'invoice') {
    const { rows: inv } = await query(`SELECT * FROM invoices WHERE id = $1`, [doc.ref_id]);
    content = inv[0] || null;
  } else if (doc.type === 'delivery_record') {
    const { rows: ro } = await query(`SELECT * FROM recon_orders WHERE id = $1`, [doc.ref_id]);
    content = ro[0] || null;
  }

  return ok(res, { document: doc, content });
});
