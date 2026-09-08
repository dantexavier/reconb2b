const { query } = require('../_lib/db');
const { withAuth, SHOP_ROLES } = require('../_lib/auth');
const { ok, methodNotAllowed } = require('../_lib/http');

const SCOPES = ['all', 'internal', 'customer'];

module.exports = withAuth(SHOP_ROLES, async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const scope = SCOPES.includes(req.query.scope) ? req.query.scope : 'all';

  const [cycleTimeByWeek, throughputByWeek, approvalRateByCategory, dealerTable] = await Promise.all([
    getCycleTimeByWeek(scope),
    getThroughputByWeek(scope),
    getApprovalRateByCategory(scope),
    getDealerTable(scope),
  ]);

  return ok(res, { scope, cycleTimeByWeek, throughputByWeek, approvalRateByCategory, dealerTable });
});

// scope is validated against a fixed enum above, so this string is never
// attacker-controlled — safe to splice into the query text.
function scopeClause(scope, alias) {
  if (scope === 'internal') return `AND ${alias}.is_internal = TRUE`;
  if (scope === 'customer') return `AND ${alias}.is_internal = FALSE`;
  return '';
}

/**
 * Blocked-time attribution: time spent with to_stage='approval' is
 * dealer-wait, to_stage='parts' is parts-wait, everything else is shop
 * touch time. Each stage_event's duration runs until the line's next
 * event (or delivery/now if it's the last one). A duration is bucketed
 * into the week its stage_event started in — a span crossing a week
 * boundary is not split, which is an acceptable simplification for a v1
 * report.
 */
async function getCycleTimeByWeek(scope) {
  const { rows } = await query(`
    WITH ordered_events AS (
      SELECT
        se.ro_line_id,
        se.to_stage,
        se.created_at,
        LEAD(se.created_at) OVER (PARTITION BY se.ro_line_id ORDER BY se.created_at) AS next_created_at,
        r.delivered_at
      FROM stage_events se
      JOIN ro_lines rl ON rl.id = se.ro_line_id
      JOIN recon_orders r ON r.id = rl.ro_id
      JOIN dealers d ON d.id = r.dealer_id
      WHERE TRUE ${scopeClause(scope, 'd')}
    ),
    durations AS (
      SELECT
        date_trunc('week', created_at)::date AS week,
        CASE
          WHEN to_stage = 'approval' THEN 'approval_wait'
          WHEN to_stage = 'parts' THEN 'parts_wait'
          ELSE 'touch'
        END AS bucket,
        EXTRACT(EPOCH FROM (COALESCE(next_created_at, COALESCE(delivered_at, now())) - created_at)) / 3600.0 AS hours
      FROM ordered_events
    )
    SELECT week, bucket, SUM(hours) AS hours
    FROM durations
    GROUP BY week, bucket
    ORDER BY week
  `);

  const byWeek = new Map();
  for (const row of rows) {
    const week = row.week.toISOString().slice(0, 10);
    if (!byWeek.has(week)) byWeek.set(week, { week, touch: 0, approvalWait: 0, partsWait: 0 });
    const bucket = { approval_wait: 'approvalWait', parts_wait: 'partsWait', touch: 'touch' }[row.bucket];
    byWeek.get(week)[bucket] = Number(row.hours);
  }
  return Array.from(byWeek.values());
}

async function getThroughputByWeek(scope) {
  const { rows } = await query(`
    SELECT date_trunc('week', r.delivered_at)::date AS week, COUNT(*) AS delivered
    FROM recon_orders r
    JOIN dealers d ON d.id = r.dealer_id
    WHERE r.delivered_at IS NOT NULL ${scopeClause(scope, 'd')}
    GROUP BY week
    ORDER BY week
  `);
  return rows.map((r) => ({ week: r.week.toISOString().slice(0, 10), delivered: Number(r.delivered) }));
}

async function getApprovalRateByCategory(scope) {
  const { rows } = await query(`
    SELECT COALESCE(lgi.category, 'custom') AS category,
           COUNT(*) FILTER (WHERE rl.approval_status = 'approved') AS approved,
           COUNT(*) FILTER (WHERE rl.approval_status IN ('approved', 'declined')) AS decided
    FROM ro_lines rl
    JOIN recon_orders r ON r.id = rl.ro_id
    JOIN dealers d ON d.id = r.dealer_id
    LEFT JOIN labor_guide_items lgi ON lgi.id = rl.labor_guide_item_id
    WHERE TRUE ${scopeClause(scope, 'd')}
    GROUP BY category
    ORDER BY category
  `);
  return rows
    .map((r) => ({
      category: r.category,
      approved: Number(r.approved),
      decided: Number(r.decided),
      rate: Number(r.decided) > 0 ? Number(r.approved) / Number(r.decided) : null,
    }))
    .filter((r) => r.decided > 0);
}

async function getDealerTable(scope) {
  const { rows: revenueRows } = await query(`
    SELECT d.id AS dealer_id, d.name, d.is_internal,
           COALESCE(SUM(rl.total_price_cents) FILTER (WHERE rl.approval_status = 'approved'), 0) AS revenue_cents,
           (
             SELECT AVG(EXTRACT(EPOCH FROM (r2.delivered_at - r2.created_at)) / 86400.0)
             FROM recon_orders r2 WHERE r2.dealer_id = d.id AND r2.delivered_at IS NOT NULL
           ) AS avg_cycle_days
    FROM dealers d
    LEFT JOIN recon_orders r ON r.dealer_id = d.id
    LEFT JOIN ro_lines rl ON rl.ro_id = r.id
    WHERE TRUE ${scopeClause(scope, 'd')}
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);

  const { rows: responseRows } = await query(`
    WITH approval_entries AS (
      SELECT DISTINCT ON (se.ro_line_id) se.ro_line_id, se.created_at AS entered_approval_at
      FROM stage_events se
      WHERE se.to_stage = 'approval'
      ORDER BY se.ro_line_id, se.created_at DESC
    ),
    decisions AS (
      SELECT rl.id AS ro_line_id, rl.approved_at AS decided_at, r.dealer_id
      FROM ro_lines rl JOIN recon_orders r ON r.id = rl.ro_id
      WHERE rl.approval_status = 'approved' AND rl.approved_at IS NOT NULL
      UNION ALL
      SELECT se.ro_line_id, se.created_at AS decided_at, r.dealer_id
      FROM stage_events se
      JOIN ro_lines rl ON rl.id = se.ro_line_id
      JOIN recon_orders r ON r.id = rl.ro_id
      WHERE se.note = 'Dealer declined'
    )
    SELECT dec.dealer_id, AVG(EXTRACT(EPOCH FROM (dec.decided_at - ae.entered_approval_at)) / 3600.0) AS avg_hours
    FROM decisions dec
    JOIN approval_entries ae ON ae.ro_line_id = dec.ro_line_id
    GROUP BY dec.dealer_id
  `);
  const responseByDealer = new Map(responseRows.map((r) => [r.dealer_id, Number(r.avg_hours)]));

  return revenueRows.map((r) => ({
    dealerId: r.dealer_id,
    dealerName: r.name,
    isInternal: r.is_internal,
    revenueCents: Number(r.revenue_cents),
    avgCycleDays: r.avg_cycle_days != null ? Number(r.avg_cycle_days) : null,
    avgApprovalResponseHours: responseByDealer.has(r.dealer_id) ? responseByDealer.get(r.dealer_id) : null,
  }));
}
