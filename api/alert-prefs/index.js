const { query } = require('../_lib/db');
const { withAuth } = require('../_lib/auth');
const { ok, badRequest, methodNotAllowed } = require('../_lib/http');

const EVENT_TYPES = [
  'estimate_ready',
  'approval_needed',
  'approval_reminder',
  'promise_date_changed',
  'qc_passed',
  'ready_for_pickup',
  'invoice_sent',
];
const CHANNELS = ['sms', 'email'];

module.exports = withAuth(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PUT') return handlePut(req, res);
  return methodNotAllowed(res, ['GET', 'PUT']);
});

async function handleGet(req, res) {
  const { rows } = await query(`SELECT event_type, channel, enabled FROM alert_prefs WHERE user_id = $1`, [req.user.id]);
  const existing = new Map(rows.map((r) => [`${r.event_type}:${r.channel}`, r.enabled]));

  const prefs = [];
  for (const eventType of EVENT_TYPES) {
    for (const channel of CHANNELS) {
      const key = `${eventType}:${channel}`;
      prefs.push({ eventType, channel, enabled: existing.has(key) ? existing.get(key) : true });
    }
  }
  return ok(res, { prefs });
}

async function handlePut(req, res) {
  const { prefs } = req.body || {};
  if (!Array.isArray(prefs)) return badRequest(res, 'prefs must be an array');

  for (const p of prefs) {
    if (!EVENT_TYPES.includes(p.eventType) || !CHANNELS.includes(p.channel)) continue;
    await query(
      `INSERT INTO alert_prefs (user_id, event_type, channel, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, event_type, channel) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [req.user.id, p.eventType, p.channel, !!p.enabled]
    );
  }

  const { rows } = await query(`SELECT event_type, channel, enabled FROM alert_prefs WHERE user_id = $1`, [req.user.id]);
  return ok(res, { prefs: rows });
}
