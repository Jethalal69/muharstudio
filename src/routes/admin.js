/**
 * MUHAR STUDIO — Admin API Routes
 * Endpoints for authentication, enquiry management, and stats.
 */

const express = require('express');
const router = express.Router();

// existing imports...
const {
  generateCsrfToken,
  requireCsrfToken
} = require('../middleware/csrf');
const config = require('../config');
const db = require('../db');
const {
  generateAdminToken,
  verifyCredentials,
  requireAdminAuth,
  adminLoginLimiter
} = require('../middleware/adminAuth');

/**
 * POST /api/admin/login
 * Authenticate admin and issue signed session cookie
 */
router.post('/login', adminLoginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  if (!(await verifyCredentials(username, password))) {
    return res.status(401).json({
      success: false,
      message: 'Invalid administrative credentials.'
    });
  }

  const token = generateAdminToken(username);

  // Set secure HTTP-only cookie
  res.cookie(config.admin.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: config.admin.maxAgeMs
  });

  return res.status(200).json({
    success: true,
    message: 'Authentication successful.',
    user: { username }
  });
});

/**
 * GET /api/admin/csrf
 * Generate CSRF token for authenticated admin
 */
router.get('/csrf', requireAdminAuth, (req, res) => {
  const token = generateCsrfToken(req.adminUser.username);

  res.json({
    success: true,
    csrfToken: token
  });
});

router.post('/logout', requireAdminAuth, requireCsrfToken, (req, res) => {
  res.clearCookie(config.admin.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict'
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/admin/me
 * Check authentication status of current user
 */
router.get('/me', requireAdminAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.adminUser
  });
});

/**
 * GET /api/admin/inquiries
 * Retrieve filtered inquiries and statistical overview
 */
/**
 * GET /api/admin/inquiries
 * Retrieve filtered inquiries and statistical overview
 */
router.get('/inquiries', requireAdminAuth, async (req, res) => {
  try {
    const { type, status, sort, search, limit, offset } = req.query;

    const result = await db.getFilteredInquiries({
      type,
      status,
      sort,
      search,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });

    const stats = await db.getInquiryStats();

    return res.status(200).json({
      success: true,
      inquiries: result.inquiries,
      total: result.total,
      stats
    });
  } catch (err) {
    console.error('Error fetching admin inquiries:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve inquiries.'
    });
  }
});

/**
 * GET /api/admin/inquiries/:id
 * Retrieve single inquiry detail by ID
 */
router.get('/inquiries/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid inquiry ID.' });
    }

    const inquiry = await db.getInquiryById(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    return res.status(200).json({
      success: true,
      inquiry
    });
  } catch (err) {
    console.error('Error fetching inquiry detail:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve inquiry detail.'
    });
  }
});

/**
 * PATCH /api/admin/inquiries/:id/status
 * Update status ('new', 'contacted', 'archived')
 */
router.patch(
  '/inquiries/:id/status',
  requireAdminAuth,
  requireCsrfToken,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;

      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid inquiry ID.' });
      }

      if (!status || !['new', 'contacted', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be one of: 'new', 'contacted', 'archived'."
        });
      }

      const updated = await db.updateInquiryStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }

      const stats = await db.getInquiryStats();

      return res.status(200).json({
        success: true,
        message: `Inquiry status updated to '${status}'.`,
        inquiry: updated,
        stats
      });
    } catch (err) {
      console.error('Error updating inquiry status:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update status.'
      });
    }
  });

/**
 * DELETE /api/admin/inquiries/:id
 * Delete inquiry by ID
 */
router.delete(
  '/inquiries/:id',
  requireAdminAuth,
  requireCsrfToken,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid inquiry ID.' });
      }

      const deleted = await db.deleteInquiry(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Inquiry deleted successfully.'
      });
    } catch (err) {
      console.error('Error deleting inquiry:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete inquiry.'
      });
    }
  });

module.exports = router;
