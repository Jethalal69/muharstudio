/**
 * MUHAR STUDIO — Admin Authentication & Security Middleware
 * HMAC-SHA256 Signed Session Token Implementation
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Generate a signed session token for admin
 * Format: base64(username:expiresAt).signature
 * @param {string} username 
 * @returns {string} Signed token string
 */
function generateAdminToken(username) {
  const expiresAt = Date.now() + config.admin.maxAgeMs;
  const payload = Buffer.from(`${username}:${expiresAt}`).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', config.admin.sessionSecret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verify and decode an admin session token
 * @param {string} token 
 * @returns {{ valid: boolean, username?: string }}
 */
function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payload, signature] = parts;

  // Verify HMAC signature with timing-safe comparison
  const expectedSig = crypto
    .createHmac('sha256', config.admin.sessionSecret)
    .update(payload)
    .digest('base64url');

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false };
    }

    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const [username, expiresAtStr] = decoded.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false }; // Expired
    }

    return { valid: true, username };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Timing-safe credential comparison
 */
function verifyCredentials(username, password) {
  if (!username || !password) return false;

  const expectedUser = config.admin.username;
  const expectedPass = config.admin.password;

  try {
    const userBuffer = Buffer.from(String(username));
    const expUserBuffer = Buffer.from(String(expectedUser));
    const passBuffer = Buffer.from(String(password));
    const expPassBuffer = Buffer.from(String(expectedPass));

    const userMatch = userBuffer.length === expUserBuffer.length && crypto.timingSafeEqual(userBuffer, expUserBuffer);
    const passMatch = passBuffer.length === expPassBuffer.length && crypto.timingSafeEqual(passBuffer, expPassBuffer);

    return userMatch && passMatch;
  } catch (err) {
    return false;
  }
}

/**
 * Middleware: Enforces Admin Authentication
 */
function requireAdminAuth(req, res, next) {
  let token = null;

  // 1. Check signed cookie
  if (req.cookies && req.cookies[config.admin.cookieName]) {
    token = req.cookies[config.admin.cookieName];
  }

  // 2. Check Authorization Header (Bearer token)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  const { valid, username } = verifyAdminToken(token);

  if (!valid) {
    const isApiRequest =
      (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
      (req.baseUrl && req.baseUrl.startsWith('/api/'));

    if (isApiRequest) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required.'
      });
    }

    // For page requests (e.g. /admin), redirect to login
    return res.redirect('/admin/login');
  }

  req.adminUser = { username };
  next();
}

/**
 * Brute-force protection on Admin Login endpoint (max 5 in prod, 50 in dev / 15 min)
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Please wait 15 minutes before trying again.'
    });
  }
});

module.exports = {
  generateAdminToken,
  verifyAdminToken,
  verifyCredentials,
  requireAdminAuth,
  adminLoginLimiter
};
