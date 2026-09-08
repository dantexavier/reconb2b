const { query } = require('../_lib/db');
const { withAuth, isDealerUser } = require('../_lib/auth');
const { ok, notFound, forbidden, badRequest, methodNotAllowed } = require('../_lib/http');
const { recalcPromiseDate } = require('../_lib/promiseDate');
const { notify } = require('../_lib/notify');

const PIPELINE_STAGES = ['inspection', 'estimate', 'approval', 'parts', 'mechanical', 'body_paint', 'detail', 'qc', 'ready'];
const BLOCKED_REASONS = ['parts', 'approval', 'sublet', 'payment'];

module.exports = withAuth(async (req, res) => {
  if (isDealerUser(req.user)) return forbidden(res, 'Dealer users cannot modify lines');
  const { id } = req.query;

  const { rows } = await query(
    `SELECT rl.*, r.dealer_id, r.status AS ro_status, v.year, v.make, v.model, v.stock_number
     FROM ro_lines rl
     JOIN recon_orders r ON r.id = rl.ro_id
     JOIN vehicles v ON v.id = r.vehicle_id
     WHERE rl.id = $1`,
    [id]
  );
  const line = rows[0];
  if (!line) return notFound(res);

  if (req.user.role === 'tech' && line.tech_id !== req.user.id) {
    return forbidden(res, 'Techs can only update their own assigned lines');
  }

  if (req.method === 'GET') return ok(res, { line });
  if (req.method === 'PATCH') return handlePatch(req, res, line);
  return methodNotAllowed(res, ['GET', 'PATCH']);
});

async function handlePatch(req, res, line) {
  const b = req.body || {};
  const isTech = req.user.role === 'tech';

  if (isTech) {
    const allowed = new Set(['stage', 'blockedReason']);
    for (const key of Object.keys(b)) {
      if (!allowed.has(key)) return forbidden(res, `Techs cannot modify field: ${key}`);
    }
  }

  if (b.stage && !PIPELINE_STAGES.includes(b.stage)) return badRequest(res, 'Invalid stage');
  if (b.blockedReason !== undefined && b.blockedReason !== null && !BLOCKED_REASONS.includes(b.blockedReason)) {
    return badRequest(res, 'Invalid blockedReason');
  }

  const next = {
    title: b.title !== undefined ? b.title : line.title,
    description: b.description !== undefined ? b.description : line.description,
    labor_hours: b.laborHours !== undefined ? b.laborHours : line.labor_hours,
    labor_rate_cents: b.laborRateCents !== undefined ? b.laborRateCents : line.labor_rate_cents,
    parts_cost_cents: b.partsCostCents !== undefined ? b.partsCostCents : line.parts_cost_cents,
    parts_price_cents: b.partsPriceCents !== undefined ? b.partsPriceCents : line.parts_price_cents,
    tech_id: b.techId !== undefined ? b.techId : line.tech_id,
    blocked_reason: b.blockedReason !== undefined ? b.blockedReason : line.blocked_reason,
    stage: b.stage || line.stage,
  };
  next.total_price_cents = Math.round(next.labor_hours * next.labor_rate_cents) + next.parts_price_cents;

  const stageChanged = next.stage !== line.stage;
  const stageEnteredAt = stageChanged ? new Date() : line.stage_entered_at;

  const { rows } = await query(
    `UPDATE ro_lines SET
      title=$1, description=$2, labor_hours=$3, labor_rate_cents=$4, parts_cost_cents=$5,
      parts_price_cents=$6, total_price_cents=$7, tech_id=$8, blocked_reason=$9, stage=$10, stage_entered_at=$11
     WHERE id=$12 RETURNING *`,
    [
      next.title,
      next.description,
      next.labor_hours,
      next.labor_rate_cents,
      next.parts_cost_cents,
      next.parts_price_cents,
      next.total_price_cents,
      next.tech_id,
      next.blocked_reason,
      next.stage,
      stageEnteredAt,
      line.id,
    ]
  );
  const updated = rows[0];

  if (stageChanged) {
    await query(
      `INSERT INTO stage_events (ro_line_id, from_stage, to_stage, user_id) VALUES ($1,$2,$3,$4)`,
      [line.id, line.stage, next.stage, req.user.id]
    );

    if (next.stage === 'ready') {
      const { rows: remaining } = await query(
        `SELECT COUNT(*) AS c FROM ro_lines WHERE ro_id = $1 AND stage != 'ready' AND approval_status != 'declined'`,
        [line.ro_id]
      );
      if (Number(remaining[0].c) === 0) {
        await query(`UPDATE recon_orders SET status = 'ready' WHERE id = $1 AND status != 'ready'`, [line.ro_id]);
        await notify('ready_for_pickup', { dealerId: line.dealer_id, vehicleLabel: vehicleLabel(line) }, req.user);
      }
    }
  }

  if (stageChanged || b.blockedReason !== undefined) {
    await recalcPromiseDate(line.ro_id, req.user);
  }

  return ok(res, { line: updated });
}

function vehicleLabel(line) {
  return [line.year, line.make, line.model].filter(Boolean).join(' ') || line.stock_number || `RO ${line.ro_id}`;
}
