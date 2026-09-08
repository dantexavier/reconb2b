const { getSessionUser } = require('../_lib/auth');
const { ok, unauthorized, methodNotAllowed, serverError } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorized(res);
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
