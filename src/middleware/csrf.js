/**
 * MUHAR STUDIO — CSRF Protection
 * Stateless signed CSRF token bound to the authenticated admin user.
 */

const crypto = require('crypto');
const config = require('../config');

function generateCsrfToken(username) {
    const expiresAt = Date.now() + config.admin.maxAgeMs;
    const nonce = crypto.randomBytes(32).toString('hex');

    const payload = Buffer.from(
        `${username}:${expiresAt}:${nonce}`
    ).toString('base64url');

    const signature = crypto
        .createHmac('sha256', config.admin.sessionSecret)
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
}

function verifyCsrfToken(token, username) {
    if (!token || typeof token !== 'string' || !username) {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;

    try {
        const expectedSignature = crypto
            .createHmac('sha256', config.admin.sessionSecret)
            .update(payload)
            .digest('base64url');

        const actualBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (
            actualBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
        ) {
            return false;
        }

        const decoded = Buffer.from(payload, 'base64url').toString('utf8');
        const [tokenUsername, expiresAt] = decoded.split(':');

        if (tokenUsername !== username) return false;
        if (!expiresAt || Date.now() > Number(expiresAt)) return false;

        return true;
    } catch {
        return false;
    }
}

function requireCsrfToken(req, res, next) {
    const token = req.get('X-CSRF-Token');

    if (!req.adminUser?.username || !verifyCsrfToken(token, req.adminUser.username)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or missing CSRF token.'
        });
    }

    next();
}

module.exports = {
    generateCsrfToken,
    verifyCsrfToken,
    requireCsrfToken
};