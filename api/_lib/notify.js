const { query } = require('./db');

const MOCK_SMS = process.env.MOCK_SMS === 'true' || !process.env.TWILIO_ACCOUNT_SID;

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendSms(toPhone, body) {
  if (MOCK_SMS || !toPhone) {
    console.log(`[MOCK_SMS] to=${toPhone || '(none)'} body="${body}"`);
    return;
  }
  const client = getTwilioClient();
  await client.messages.create({
    to: toPhone,
    from: process.env.TWILIO_FROM_NUMBER,
    body,
  });
}

async function sendEmail(toEmail, subject, body) {
  // No email provider in the stack yet — log for now, same interface shape as SMS.
  console.log(`[MOCK_EMAIL] to=${toEmail} subject="${subject}" body="${body}"`);
}

// Which dealer-side roles are relevant recipients per event type.
const EVENT_RECIPIENT_ROLES = {
  estimate_ready: ['manager'],
  approval_needed: ['manager'],
  approval_reminder: ['manager'],
  promise_date_changed: ['manager', 'viewer'],
  qc_passed: ['manager', 'viewer'],
  ready_for_pickup: ['manager', 'viewer'],
  invoice_sent: ['manager', 'billing'],
};

const EVENT_MESSAGES = {
  estimate_ready: (m) => `ReconOS: estimate ready for review on ${m.vehicleLabel}.`,
  approval_needed: (m) => `ReconOS: approval needed on ${m.vehicleLabel} (${m.lineCount} line(s)).`,
  approval_reminder: (m) => `ReconOS reminder: ${m.vehicleLabel} still awaiting your approval.`,
  promise_date_changed: (m) => `ReconOS: promise date for ${m.vehicleLabel} changed to ${m.promisedAt}. Reason: ${m.reason}`,
  qc_passed: (m) => `ReconOS: ${m.vehicleLabel} passed QC.`,
  ready_for_pickup: (m) => `ReconOS: ${m.vehicleLabel} is ready for pickup.`,
  invoice_sent: (m) => `ReconOS: invoice for ${m.vehicleLabel} has been sent.`,
};

/**
 * notify(eventType, { dealerId, vehicleLabel, ...meta }, actor)
 * Looks up relevant dealer users, checks their alert_prefs, writes a
 * notifications row per enabled channel, and dispatches via Twilio (or the
 * console-log mocks above).
 */
async function notify(eventType, context, actor) {
  const roles = EVENT_RECIPIENT_ROLES[eventType];
  if (!roles) throw new Error(`Unknown notify event type: ${eventType}`);

  const { rows: recipients } = await query(
    `SELECT id, name, email, phone FROM users WHERE dealer_id = $1 AND role = ANY($2) AND active = TRUE`,
    [context.dealerId, roles]
  );
  if (recipients.length === 0) return [];

  const messageBuilder = EVENT_MESSAGES[eventType] || (() => `ReconOS: ${eventType}`);
  const body = messageBuilder(context);
  const results = [];

  for (const recipient of recipients) {
    const { rows: prefs } = await query(
      `SELECT channel, enabled FROM alert_prefs WHERE user_id = $1 AND event_type = $2`,
      [recipient.id, eventType]
    );
    const prefByChannel = Object.fromEntries(prefs.map((p) => [p.channel, p.enabled]));
    // Default to enabled on both channels if the user has never configured this event.
    const smsEnabled = prefByChannel.sms !== undefined ? prefByChannel.sms : true;
    const emailEnabled = prefByChannel.email !== undefined ? prefByChannel.email : true;

    if (smsEnabled) {
      await sendSms(recipient.phone, body);
      await query(
        `INSERT INTO notifications (user_id, event_type, payload, channel) VALUES ($1, $2, $3, 'sms')`,
        [recipient.id, eventType, JSON.stringify({ ...context, body, actorId: actor && actor.id })]
      );
      results.push({ userId: recipient.id, channel: 'sms' });
    }
    if (emailEnabled) {
      await sendEmail(recipient.email, `ReconOS: ${eventType}`, body);
      await query(
        `INSERT INTO notifications (user_id, event_type, payload, channel) VALUES ($1, $2, $3, 'email')`,
        [recipient.id, eventType, JSON.stringify({ ...context, body, actorId: actor && actor.id })]
      );
      results.push({ userId: recipient.id, channel: 'email' });
    }
  }
  return results;
}

function buildMessage(eventType, context) {
  const messageBuilder = EVENT_MESSAGES[eventType] || (() => `ReconOS: ${eventType}`);
  return messageBuilder(context);
}

module.exports = { notify, sendSms, sendEmail, buildMessage };
