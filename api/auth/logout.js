const { getSessionIdFromReq, destroySession, clearSessionCookie } = require('../_lib/auth');
const { ok, methodNotAllowed, serverError } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const sid = getSessionIdFromReq(req);
    await destroySession(sid);
    clearSessionCookie(res);
    return ok(res, { success: true });
  } catch (err) {
    return serverError(res, err);
  }
};
