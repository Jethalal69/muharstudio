/**
 * MUHAR STUDIO — Backend Configuration
 * Centralized environment variable loader with sensible defaults.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',

  // Admin Authentication
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'muhar_studio_2026!',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || 'muhar_studio_super_secret_session_key_2026_x89',
    cookieName: 'muhar_admin_token',
    maxAgeMs: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Database
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, '..', 'data', 'inquiries.db'),

  // Email / SMTP Settings
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.FROM_EMAIL || '"MUHAR STUDIO" <notifications@muharstudio.com>',
    notificationEmail: process.env.NOTIFICATION_EMAIL || 'hello@muharstudio.com',
    isConfigured: () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  },

  // Security & Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10 // max 10 submissions per IP per 15 min
  }
};

module.exports = config;
