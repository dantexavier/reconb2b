const bcrypt = require('bcrypt');
const { query } = require('./db');
const { parseCookies, setCookie, clearCookie, unauthorized, forbidden, serverError } = require('./http');

const SESSION_COOKIE = 'reconos_sid';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function createSession(userId) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const { rows } = await query(
    'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
    [userId, expiresAt]
  );
  return rows[0].id;
}

async function destroySession(sessionId) {
  if (!sessionId) return;
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

function setSessionCookie(res, sessionId) {
  setCookie(res, SESSION_COOKIE, sessionId, { maxAgeSeconds: SESSION_TTL_SECONDS });
}

function clearSessionCookie(res) {
  clearCookie(res, SESSION_COOKIE);
}

function getSessionIdFromReq(req) {
  return parseCookies(req)[SESSION_COOKIE];
}

async function getSessionUser(req) {
  const sid = getSessionIdFromReq(req);
  if (!sid) return null;
  const { rows } = await query(
    `SELECT u.id, u.dealer_id, u.role, u.name, u.email, u.phone, s.id AS session_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.active = TRUE`,
    [sid]
  );
  return rows[0] || null;
}

const SHOP_ROLES = ['owner', 'advisor', 'tech'];
const DEALER_ROLES = ['manager', 'viewer', 'billing'];

function isShopUser(user) {
  return !!user && user.dealer_id == null && SHOP_ROLES.includes(user.role);
}

function isDealerUser(user) {
  return !!user && user.dealer_id != null && DEALER_ROLES.includes(user.role);
}

/**
 * Wraps a Vercel API handler, requiring a valid session.
 * `roles` restricts by role name; omit for "any authenticated user".
 */
function withAuth(roles, handler) {
  if (typeof roles === 'function') {
    handler = roles;
    roles = null;
  }
  return async (req, res) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return unauthorized(res);
      if (roles && !roles.includes(user.role)) return forbidden(res);
      req.user = user;
      return await handler(req, res);
    } catch (err) {
      serverError(res, err);
    }
  };
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromReq,
  getSessionUser,
  isShopUser,
  isDealerUser,
  withAuth,
  SHOP_ROLES,
  DEALER_ROLES,
};
