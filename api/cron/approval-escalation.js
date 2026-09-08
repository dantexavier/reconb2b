const { query } = require('../_lib/db');
const { notify, sendSms, sendEmail, buildMessage } = require('../_lib/notify');
const { ok, unauthorized, methodNotAllowed, serverError } = require('../_lib/http');

/**
 * Vercel Cron target (see vercel.json `crons`). Finds ro_lines sitting in
 * approval_status='pending' + stage='approval' for more than 24h and fires
 * an approval_reminder — repeating once per 24h until resolved, via
 * last_reminder_sent_at as the dedupe marker. Also directly CCs the
 * dealer's secondary contact (a raw contact field on the dealer, not a
 * user account) when one exists, per the escalation business rule.
 */
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  if (process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return unauthorized(res, 'Invalid cron secret');
    }
  } else {
    console.warn('CRON_SECRET is not set — approval-escalation endpoint is unauthenticated');
  }

  try {
    const { rows: staleLines } = await query(
      `SELECT rl.id AS line_id, r.id AS ro_id, r.dealer_id,
              v.year, v.make, v.model, v.stock_number,
              d.secondary_contact_phone, d.secondary_contact_email
       FROM ro_lines rl
       JOIN recon_orders r ON r.id = rl.ro_id
       JOIN vehicles v ON v.id = r.vehicle_id
       JOIN dealers d ON d.id = r.dealer_id
       WHERE rl.approval_status = 'pending'
         AND rl.stage = 'approval'
         AND rl.stage_entered_at < now() - INTERVAL '24 hours'
         AND (rl.last_reminder_sent_at IS NULL OR rl.last_reminder_sent_at < now() - INTERVAL '24 hours')`
    );

    if (staleLines.length === 0) {
      return ok(res, { remindersSent: 0 });
    }

    // One reminder per RO (a vehicle with 3 stale lines gets one text, not 3).
    const byRo = new Map();
    for (const line of staleLines) {
      if (!byRo.has(line.ro_id)) byRo.set(line.ro_id, { ...line, lineIds: [] });
      byRo.get(line.ro_id).lineIds.push(line.line_id);
    }

    let remindersSent = 0;
    for (const ro of byRo.values()) {
      const vehicleLabel = [ro.year, ro.make, ro.model].filter(Boolean).join(' ') || ro.stock_number;
      await notify('approval_reminder', { dealerId: ro.dealer_id, vehicleLabel }, null);

      if (ro.secondary_contact_phone || ro.secondary_contact_email) {
        const body = buildMessage('approval_reminder', { vehicleLabel });
        if (ro.secondary_contact_phone) await sendSms(ro.secondary_contact_phone, body);
        if (ro.secondary_contact_email) await sendEmail(ro.secondary_contact_email, 'ReconOS: approval_reminder', body);
      }

      await query(`UPDATE ro_lines SET last_reminder_sent_at = now() WHERE id = ANY($1)`, [ro.lineIds]);
      remindersSent += 1;
    }

    return ok(res, { remindersSent, staleLines: staleLines.length });
  } catch (err) {
    return serverError(res, err);
  }
};
