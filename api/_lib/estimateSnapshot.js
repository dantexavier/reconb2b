const { query } = require('./db');

async function buildLinesSnapshot(roId) {
  const { rows } = await query(
    `SELECT id, title, description, finding_photos, labor_hours, labor_rate_cents,
            parts_cost_cents, parts_price_cents, total_price_cents, approval_status,
            approved_by_user_id, approved_at, stage, blocked_reason
     FROM ro_lines WHERE ro_id = $1 ORDER BY created_at ASC`,
    [roId]
  );
  return rows;
}

async function getNextSentVersion(roId) {
  const { rows } = await query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM estimate_snapshots WHERE ro_id = $1 AND kind = 'sent'`,
    [roId]
  );
  return Number(rows[0].next);
}

async function getLatestSentVersion(roId) {
  const { rows } = await query(
    `SELECT COALESCE(MAX(version), 1) AS v FROM estimate_snapshots WHERE ro_id = $1 AND kind = 'sent'`,
    [roId]
  );
  return Number(rows[0].v);
}

async function writeSnapshot({ roId, version, kind, actorUserId }) {
  const lines = await buildLinesSnapshot(roId);
  const { rows } = await query(
    `INSERT INTO estimate_snapshots (ro_id, version, snapshot, kind, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [roId, version, JSON.stringify({ lines }), kind, actorUserId || null]
  );
  return rows[0];
}

module.exports = { buildLinesSnapshot, getNextSentVersion, getLatestSentVersion, writeSnapshot };
