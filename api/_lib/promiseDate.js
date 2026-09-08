const { query } = require('./db');
const { notify } = require('./notify');

async function getSetting(key, fallback) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
  if (rows.length === 0) return fallback;
  return rows[0].value;
}

const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function addWorkingDays(startDate, numDays, workingDays) {
  const date = new Date(startDate);
  let remaining = numDays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (workingDays.includes(DAY_ABBR[date.getDay()])) {
      remaining -= 1;
    }
  }
  return date;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Promise date engine v1.
 *
 * promised_at = today + ceil(sum of approved+pending labor hours queued at
 * or ahead of this RO / daily capacity) working days + parts ETA buffer
 * (in working days) if any line on this RO is blocked on parts.
 *
 * v1 scope: recalculates only the RO passed in, on the trigger events the
 * spec calls out (new intake, approval received, parts ETA change, line
 * completion) rather than cascading to every RO behind it in the queue.
 */
async function recalcPromiseDate(roId, actorUser) {
  const { rows: roRows } = await query(
    `SELECT id, dealer_id, created_at, promised_at, promise_reason_log FROM recon_orders WHERE id = $1`,
    [roId]
  );
  const ro = roRows[0];
  if (!ro) return null;

  const { rows: hoursRows } = await query(
    `SELECT COALESCE(SUM(rl.labor_hours), 0) AS total_hours
     FROM ro_lines rl
     JOIN recon_orders r ON r.id = rl.ro_id
     WHERE rl.approval_status IN ('approved', 'pending')
       AND rl.stage != 'ready'
       AND r.created_at <= $1`,
    [ro.created_at]
  );
  const totalHours = Number(hoursRows[0].total_hours);

  const { rows: blockedRows } = await query(
    `SELECT 1 FROM ro_lines WHERE ro_id = $1 AND blocked_reason = 'parts' LIMIT 1`,
    [roId]
  );
  const waitingOnParts = blockedRows.length > 0;

  const dailyCapacity = Number(await getSetting('daily_capacity_hours', 24));
  const workingDays = await getSetting('working_days', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

  let partsEtaDays = 0;
  if (waitingOnParts) {
    // Prefer the real ETA on open parts orders for this RO; fall back to
    // the flat setting when a line is flagged blocked_reason='parts' but
    // has no parts order recorded yet.
    const { rows: etaRows } = await query(
      `SELECT MAX(po.eta_date) AS max_eta
       FROM parts_orders po
       JOIN ro_lines rl ON rl.id = po.ro_line_id
       WHERE rl.ro_id = $1 AND po.status = 'ordered' AND po.eta_date IS NOT NULL`,
      [roId]
    );
    const maxEta = etaRows[0].max_eta;
    if (maxEta) {
      const daysUntilEta = Math.ceil((new Date(maxEta) - new Date()) / (24 * 3600 * 1000));
      partsEtaDays = Math.max(daysUntilEta, 0);
    } else {
      partsEtaDays = Number(await getSetting('default_parts_eta_days', 3));
    }
  }

  const businessDaysNeeded = Math.ceil(totalHours / dailyCapacity) + partsEtaDays;
  const newPromiseDate = toDateOnly(addWorkingDays(new Date(), businessDaysNeeded, workingDays));
  const oldPromiseDate = ro.promised_at ? toDateOnly(new Date(ro.promised_at)) : null;

  if (newPromiseDate === oldPromiseDate) {
    return newPromiseDate;
  }

  const reason = waitingOnParts
    ? `Recalculated: ${totalHours}h queued ahead + parts buffer`
    : `Recalculated: ${totalHours}h queued ahead`;
  const logEntry = { at: new Date().toISOString(), from: oldPromiseDate, to: newPromiseDate, reason };
  const nextLog = [...(ro.promise_reason_log || []), logEntry];

  await query(
    `UPDATE recon_orders SET promised_at = $1, promise_reason_log = $2 WHERE id = $3`,
    [newPromiseDate, JSON.stringify(nextLog), roId]
  );

  if (oldPromiseDate) {
    const { rows: vehicleRows } = await query(
      `SELECT v.year, v.make, v.model, v.stock_number FROM vehicles v
       JOIN recon_orders r ON r.vehicle_id = v.id WHERE r.id = $1`,
      [roId]
    );
    const v = vehicleRows[0] || {};
    const vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(' ') || v.stock_number || 'vehicle';
    await notify(
      'promise_date_changed',
      { dealerId: ro.dealer_id, vehicleLabel, promisedAt: newPromiseDate, reason },
      actorUser
    );
  }

  return newPromiseDate;
}

module.exports = { recalcPromiseDate, addWorkingDays, getSetting };
