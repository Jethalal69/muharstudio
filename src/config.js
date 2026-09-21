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
    username: process.env.ADMIN_USERNAME || '',
    password: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
    cookieName: 'muhar_admin_token',
    maxAgeMs: 24 * 60 * 60 * 1000
  },

  // Database (PostgreSQL for cloud/Vercel, SQLite for local fallback)
  databaseUrl: (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.PGURI ||
    ''
  ).trim(),
  isPostgres: Boolean(
    (
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.NEON_DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.PGURI ||
      ''
    ).trim()
  ),
  isVercel: Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION ||
    process.env.LAMBDA_TASK_ROOT
  ),
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

  // Retell AI Configuration (Voice AI Receptionist)
  retell: {
    apiKey: process.env.RETELL_API_KEY || '',
    agentId: process.env.RETELL_AGENT_ID || '',
    isConfigured: () => Boolean(process.env.RETELL_API_KEY && process.env.RETELL_API_KEY.trim())
  },

  // Security & Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10 // max 10 submissions per IP per 15 min
  }
};

// Production security checks
if (config.isProduction) {
  const missing = [];

  if (!config.admin.username) missing.push('ADMIN_USERNAME');
  if (!config.admin.password) missing.push('ADMIN_PASSWORD');
  if (!config.admin.sessionSecret) missing.push('ADMIN_SESSION_SECRET');
  if (!config.allowedOrigin) missing.push('ALLOWED_ORIGIN');
  if (!config.databaseUrl) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    );
  }
}


module.exports = config;
