function sendJson(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function ok(res, data) {
  sendJson(res, 200, data);
}

function created(res, data) {
  sendJson(res, 201, data);
}

function badRequest(res, message) {
  sendJson(res, 400, { error: message || 'Bad request' });
}

function unauthorized(res, message) {
  sendJson(res, 401, { error: message || 'Unauthorized' });
}

function forbidden(res, message) {
  sendJson(res, 403, { error: message || 'Forbidden' });
}

function notFound(res, message) {
  sendJson(res, 404, { error: message || 'Not found' });
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: 'Method not allowed' });
}

function serverError(res, err) {
  console.error(err);
  sendJson(res, 500, { error: 'Internal server error' });
}

function parseCookies(req) {
  if (req.cookies) return req.cookies;
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function setCookie(res, name, value, { maxAgeSeconds } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  const existing = res.getHeader('Set-Cookie');
  const cookieStr = parts.join('; ');
  if (existing) {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAgeSeconds: 0 });
}

module.exports = {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  serverError,
  parseCookies,
  setCookie,
  clearCookie,
};
