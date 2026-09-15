/**
 * MUHAR STUDIO — Health Check Route Handler
 * Endpoint: GET /api/health
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const isDbHealthy = await db.pingDatabase();

    const baseDir = path.resolve(__dirname, '..');
    const filesCheck = {
      baseDir,
      hasNavbarCss: fs.existsSync(path.join(baseDir, 'navbar.css')),
      hasHeroImage: fs.existsSync(path.join(baseDir, 'assets', 'hero-image.jpeg')),
      rootDirContents: fs.readdirSync(baseDir).filter(f => !f.startsWith('.'))
    };

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: isDbHealthy ? 'healthy' : 'degraded',
      engine: db.isPostgres ? 'postgresql' : 'sqlite',
      filesCheck
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Database check failed',
      error: error.message
    });
  }
});

module.exports = router;
