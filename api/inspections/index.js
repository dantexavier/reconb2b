const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, created, notFound, badRequest, methodNotAllowed } = require('../_lib/http');
const { addDocument } = require('../_lib/documents');

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { roId } = req.query;
  const params = [];
  let where = '';
  if (roId) {
    params.push(roId);
    where = `WHERE i.ro_id = $1`;
  }
  const { rows } = await query(
    `SELECT i.*, u.name AS tech_name FROM inspections i LEFT JOIN users u ON u.id = i.tech_id ${where} ORDER BY i.created_at DESC`,
    params
  );
  return ok(res, { inspections: rows });
}

async function handleCreate(req, res) {
  const b = req.body || {};
  if (!b.roId) return badRequest(res, 'roId is required');

  const { rows: roRows } = await query(
    `SELECT r.dealer_id, v.id AS vehicle_id FROM recon_orders r JOIN vehicles v ON v.id = r.vehicle_id WHERE r.id = $1`,
    [b.roId]
  );
  const ro = roRows[0];
  if (!ro) return notFound(res, 'Recon order not found');

  const techId = b.techId || (req.user.role === 'tech' ? req.user.id : null);

  const { rows } = await query(
    `INSERT INTO inspections (ro_id, tech_id, checklist, findings, completed_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [b.roId, techId, JSON.stringify(b.checklist || []), JSON.stringify(b.findings || []), b.completedAt || new Date()]
  );
  const inspection = rows[0];

  await addDocument({ vehicleId: ro.vehicle_id, dealerId: ro.dealer_id, type: 'inspection', refId: inspection.id, title: 'Inspection report' });

  await query(`UPDATE recon_orders SET status = 'inspection' WHERE id = $1 AND status = 'intake'`, [b.roId]);

  return created(res, { inspection });
}
