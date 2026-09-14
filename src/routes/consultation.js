/**
 * MUHAR STUDIO — Consultation Form Route Handler
 * Endpoint: POST /api/consultation
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const emailService = require('../email');
const { submissionLimiter } = require('../middleware/rateLimiter');
const { sanitizeMiddleware } = require('../middleware/sanitize');
const { validateConsultation } = require('../middleware/validate');

router.post(
  '/',
  submissionLimiter,
  sanitizeMiddleware,
  validateConsultation,
  async (req, res) => {
    try {
      const { name, email, phone, projectType, budget, message } = req.body;
      
      const ipAddress = (
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        req.ip ||
        ''
      ).split(',')[0].trim();

      const userAgent = req.headers['user-agent'] || '';

      // 1. Persist inquiry into SQLite database
      const record = db.saveInquiry({
        type: 'consultation',
        name,
        email,
        phone: phone || null,
        projectType,
        budget,
        message,
        ipAddress,
        userAgent,
        emailSent: false
      });

      // 2. Dispatch Email Notification (Asynchronous / Non-blocking to DB persistence)
      emailService.sendInquiryNotification({
        id: record.id,
        type: 'consultation',
        name,
        email,
        phone,
        projectType,
        budget,
        message,
        ipAddress
      }).then(emailResult => {
        if (emailResult.success) {
          db.updateEmailStatus(record.id, true);
        }
      }).catch(err => {
        console.error(`[Inquiry #${record.id}] Email dispatch warning:`, err.message);
      });

      // 3. Return immediate clean JSON success response
      return res.status(201).json({
        success: true,
        message: 'Thank you. We’ll be in touch shortly.',
        inquiryId: record.id
      });

    } catch (error) {
      console.error('Error handling consultation submission:', error);
      return res.status(500).json({
        success: false,
        message: 'An internal error occurred while saving your inquiry. Please contact hello@muharstudio.com directly.'
      });
    }
  }
);

module.exports = router;
