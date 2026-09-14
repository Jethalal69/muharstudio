/**
 * MUHAR STUDIO — General Contact Route Handler
 * Endpoint: POST /api/contact
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const emailService = require('../email');
const { submissionLimiter } = require('../middleware/rateLimiter');
const { sanitizeMiddleware } = require('../middleware/sanitize');
const { validateContact } = require('../middleware/validate');

router.post(
  '/',
  submissionLimiter,
  sanitizeMiddleware,
  validateContact,
  async (req, res) => {
    try {
      const { name, email, phone, message } = req.body;

      const ipAddress = (
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        req.ip ||
        ''
      ).split(',')[0].trim();

      const userAgent = req.headers['user-agent'] || '';

      // 1. Persist contact inquiry into SQLite database
      const record = db.saveInquiry({
        type: 'contact',
        name,
        email,
        phone: phone || null,
        message,
        ipAddress,
        userAgent,
        emailSent: false
      });

      // 2. Dispatch Email Notification
      emailService.sendInquiryNotification({
        id: record.id,
        type: 'contact',
        name,
        email,
        phone,
        message,
        ipAddress
      }).then(emailResult => {
        if (emailResult.success) {
          db.updateEmailStatus(record.id, true);
        }
      }).catch(err => {
        console.error(`[Contact #${record.id}] Email dispatch warning:`, err.message);
      });

      // 3. Return immediate clean JSON response
      return res.status(201).json({
        success: true,
        message: 'Thank you. Your message has been received.',
        inquiryId: record.id
      });

    } catch (error) {
      console.error('Error handling contact submission:', error);
      return res.status(500).json({
        success: false,
        message: 'An internal error occurred while processing your message. Please contact hello@muharstudio.com directly.'
      });
    }
  }
);

module.exports = router;
