/**
 * MUHAR STUDIO — Health Check Route Handler
 * Endpoint: GET /api/health
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    // Ping SQLite database
    const ping = db.db.prepare('SELECT 1 AS ok').get();
    const isDbHealthy = ping && ping.ok === 1;

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: isDbHealthy ? 'healthy' : 'degraded'
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
