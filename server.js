/**
 * MUHAR STUDIO — Production Server
 * Express-based backend with security headers, CORS, rate limiting,
 * SQLite storage, transactional email dispatch, private admin portal, and clean static routing.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./src/config');

// Route imports
const consultationRoutes = require('./src/routes/consultation');
const contactRoutes = require('./src/routes/contact');
const healthRoutes = require('./src/routes/health');
const adminRoutes = require('./src/routes/admin');
const { requireAdminAuth } = require('./src/middleware/adminAuth');

const app = express();
const BASE_DIR = __dirname;

// Trust proxy if deployed behind reverse proxy (e.g., Nginx, Cloudflare, Fly.io, Railway, Heroku)
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS Policy
app.use(
  cors({
    origin: config.allowedOrigin === '*' ? true : config.allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  })
);

// Cookie Parser for Admin Sessions
app.use(cookieParser(config.admin.sessionSecret));

// Request body parsers with strict size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================================================
// SENSITIVE FILE PROTECTION BARRIER
// Strictly block direct public HTTP access to database files, env, and source
// ============================================================================
app.use((req, res, next) => {
  const normalizedPath = path.normalize(decodeURIComponent(req.path)).toLowerCase();

  const isBlocked =
    normalizedPath.startsWith('/data') ||
    normalizedPath.startsWith('\\data') ||
    normalizedPath.startsWith('/src') ||
    normalizedPath.startsWith('\\src') ||
    normalizedPath.startsWith('/scratch') ||
    normalizedPath.startsWith('\\scratch') ||
    normalizedPath.includes('.db') ||
    normalizedPath.includes('.env') ||
    normalizedPath.includes('.git') ||
    normalizedPath.includes('package.json') ||
    normalizedPath.includes('package-lock.json');

  if (isBlocked) {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    const notFoundPath = path.join(BASE_DIR, '404.html');
    if (fs.existsSync(notFoundPath)) {
      return res.status(404).sendFile(notFoundPath);
    }
    return res.status(404).send('404 Not Found');
  }

  next();
});

// ============================================================================
// API ROUTES
// ============================================================================
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'online',
    name: 'MUHAR STUDIO API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      consultation: '/api/consultation',
      contact: '/api/contact',
      admin: '/admin'
    }
  });
});

app.use('/api/consultation', consultationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================================
// ADMIN PORTAL ROUTES
// ============================================================================
// Public Admin Login Page
app.get('/admin/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(BASE_DIR, 'admin', 'login.html'));
});

// Admin Static Assets (CSS, JS)
app.get('/admin/admin.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(BASE_DIR, 'admin', 'admin.css'));
});

app.get('/admin/admin.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(BASE_DIR, 'admin', 'admin.js'));
});

// Protected Admin Dashboard
app.get('/admin', requireAdminAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(BASE_DIR, 'admin', 'index.html'));
});

// ============================================================================
// PUBLIC WEBSITE STATIC ROUTING & CLEAN URL RESOLUTION
// ============================================================================
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) return next();

  if (!path.extname(req.path) && req.path !== '/') {
    const cleanPath = req.path.replace(/\/$/, '');
    const htmlFile = path.join(BASE_DIR, `${cleanPath}.html`);
    const indexFile = path.join(BASE_DIR, cleanPath, 'index.html');

    if (fs.existsSync(htmlFile)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(htmlFile);
    }
    if (fs.existsSync(indexFile)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexFile);
    }
  }
  next();
});

// Static file serving for public images, css, client js
app.use(
  express.static(BASE_DIR, {
    extensions: ['html'],
    dotfiles: 'ignore',
    maxAge: config.isProduction ? '1d' : '0',
    setHeaders: (res, filePath) => {
      // Don't cache HTML files in production to allow instant content updates
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint '${req.method} ${req.path}' not found.`
    });
  }

  const notFoundPath = path.join(BASE_DIR, '404.html');
  if (fs.existsSync(notFoundPath)) {
    return res.status(404).sendFile(notFoundPath);
  }
  return res.status(404).send('404 Not Found');
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);

  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      message: config.isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : err.message
    });
  }

  res.status(500).send('500 Internal Server Error');
});

// Start Server if executed directly (Standalone Node process)
let server = null;
if (require.main === module) {
  server = app.listen(config.port, () => {
    console.log(`\n============================================================`);
    console.log(`🏛️  MUHAR STUDIO backend server running in ${config.nodeEnv.toUpperCase()} mode`);
    console.log(`📍 Public Site: http://localhost:${config.port}`);
    console.log(`🔐 Admin Portal: http://localhost:${config.port}/admin`);
    console.log(`🩺 Health check: http://localhost:${config.port}/api/health`);
    console.log(`💾 Database: ${config.isPostgres ? 'PostgreSQL (Cloud)' : config.databasePath}`);
    console.log(`✉️  SMTP Configured: ${config.smtp.isConfigured() ? 'YES' : 'NO (Simulation Mode)'}`);
    console.log(`============================================================\n`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
