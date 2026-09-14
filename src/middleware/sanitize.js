/**
 * MUHAR STUDIO — Request Sanitization & Anti-Spam Middleware
 */

/**
 * Escapes characters that have HTML meaning
 * @param {string} str 
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Recursively sanitize all string properties in an object
 * @param {Object} obj 
 * @returns {Object}
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeObject(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Express middleware to sanitize body and detect honeypot spam bots
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Honeypot check: If hidden honeypot fields are filled, silently drop spam bot
    const honeypotFields = ['_hp', '_gotcha', 'honeypot', 'website_url_hp'];
    for (const hp of honeypotFields) {
      if (req.body[hp] && String(req.body[hp]).trim() !== '') {
        // Silently return success to bot without executing db write or email dispatch
        return res.status(200).json({
          success: true,
          message: "Thank you. We'll be in touch shortly."
        });
      }
    }

    // Clean body strings
    req.body = sanitizeObject(req.body);
  }

  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeMiddleware
};
