const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, created, badRequest, forbidden, methodNotAllowed } = require('../_lib/http');

const PIPELINE_STAGES = ['inspection', 'estimate', 'approval', 'parts', 'mechanical', 'body_paint', 'detail', 'qc', 'ready'];

module.exports = withAuth(async (req, res) => {
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'POST') return handleCreate(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
});

async function handleList(req, res) {
  const { stage, techId, blocked, roId, includeDeclined } = req.query;
  const params = [];
  const clauses = [];

  if (isDealerUser(req.user)) {
    params.push(req.user.dealer_id);
    clauses.push(`r.dealer_id = $${params.length}`);
  }
  if (req.user.role === 'tech') {
    params.push(req.user.id);
    clauses.push(`rl.tech_id = $${params.length}`);
  }
  if (stage) {
    params.push(stage);
    clauses.push(`rl.stage = $${params.length}`);
  }
  if (techId) {
    params.push(techId);
    clauses.push(`rl.tech_id = $${params.length}`);
  }
  if (roId) {
    params.push(roId);
    clauses.push(`rl.ro_id = $${params.length}`);
  }
  if (blocked === 'true') {
    clauses.push(`rl.blocked_reason IS NOT NULL`);
  }
  if (includeDeclined !== 'true') {
    clauses.push(`rl.approval_status != 'declined'`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT rl.*, r.dealer_id, r.status AS ro_status, r.promised_at,
            v.year, v.make, v.model, v.trim, v.stock_number, v.vin,
            d.name AS dealer_name, u.name AS tech_name
     FROM ro_lines rl
     JOIN recon_orders r ON r.id = rl.ro_id
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN dealers d ON d.id = r.dealer_id
     LEFT JOIN users u ON u.id = rl.tech_id
     ${where}
     ORDER BY rl.stage_entered_at ASC`,
    params
  );
  return ok(res, { lines: rows });
}

async function handleCreate(req, res) {
  if (isDealerUser(req.user)) return forbidden(res, 'Dealer users cannot create lines');
  const b = req.body || {};
  if (!b.roId || !b.title) return badRequest(res, 'roId and title are required');
  if (b.stage && !PIPELINE_STAGES.includes(b.stage)) return badRequest(res, 'Invalid stage');

  const laborHours = b.laborHours || 0;
  const laborRateCents = b.laborRateCents || 0;
  const partsCostCents = b.partsCostCents || 0;
  const partsPriceCents = b.partsPriceCents || 0;
  const totalPriceCents = Math.round(laborHours * laborRateCents) + partsPriceCents;

  const { rows } = await query(
    `INSERT INTO ro_lines (ro_id, title, description, finding_photos, labor_hours, labor_rate_cents, parts_cost_cents, parts_price_cents, total_price_cents, stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      b.roId,
      b.title,
      b.description || null,
      JSON.stringify(b.findingPhotos || []),
      laborHours,
      laborRateCents,
      partsCostCents,
      partsPriceCents,
      totalPriceCents,
      b.stage || 'estimate',
    ]
  );
  const line = rows[0];

  await query(
    `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id, note) VALUES ($1, NULL, $2, $3, 'Line created')`,
    [line.id, line.stage, req.user.id]
  );

  return created(res, { line });
}
