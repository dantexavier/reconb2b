const { query } = require('../_lib/db');
const { verifyPassword, createSession, setSessionCookie } = require('../_lib/auth');
const { ok, badRequest, unauthorized, methodNotAllowed, serverError } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return badRequest(res, 'email and password are required');

    const { rows } = await query(
      `SELECT id, dealer_id, role, name, email, phone, password_hash FROM users WHERE email = $1 AND active = TRUE`,
      [String(email).toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return unauthorized(res, 'Invalid email or password');

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) return unauthorized(res, 'Invalid email or password');

    const sessionId = await createSession(user.id);
    setSessionCookie(res, sessionId);

    return ok(res, {
      user: {
        id: user.id,
        dealerId: user.dealer_id,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    return serverError(res, err);
  }
};
