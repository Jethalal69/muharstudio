/**
 * MUHAR STUDIO — Rate Limiting Middleware
 * Protects public submission endpoints against abuse and brute-force flooding.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const submissionLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return standard RateLimit headers in response
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many submission attempts from this IP address. Please wait a few minutes before trying again.'
    });
  }
});

module.exports = {
  submissionLimiter
};
