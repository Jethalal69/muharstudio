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

    const cwd = process.cwd();
    const serverDir = path.resolve(__dirname, '../..');
    const filesCheck = {
      cwd,
      cwdContents: fs.existsSync(cwd) ? fs.readdirSync(cwd) : [],
      serverDir,
      serverDirContents: fs.existsSync(serverDir) ? fs.readdirSync(serverDir) : [],
      hasNavbarCssInCwd: fs.existsSync(path.join(cwd, 'navbar.css')),
      hasNavbarCssInServerDir: fs.existsSync(path.join(serverDir, 'navbar.css'))
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
