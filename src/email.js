/**
 * MUHAR STUDIO — Email Notification Service
 * Transports incoming inquiries to studio admin and sends client acknowledgement.
 * Gracefully handles missing SMTP credentials in dev mode without failing user requests.
 */

const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;

if (config.smtp.isConfigured()) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
}

/**
 * Generate luxury editorial HTML email template for Studio Admin
 * @param {Object} data
 * @returns {string} HTML string
 */
function buildAdminEmailHtml(data) {
  const isConsultation = data.type === 'consultation';
  const title = isConsultation ? 'New Consultation Request' : 'New Studio Contact Inquiry';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #24211E; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF7F2; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid rgba(36, 33, 30, 0.12); padding: 40px 40px;">
          <!-- Brand Header -->
          <tr>
            <td style="border-bottom: 1px solid rgba(36, 33, 30, 0.12); padding-bottom: 24px; text-align: left;">
              <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #6B6560; display: block; margin-bottom: 8px;">MUHAR STUDIO NOTIFICATION</span>
              <h1 style="font-family: Georgia, serif; font-size: 26px; font-weight: 400; color: #24211E; margin: 0 0 6px 0; letter-spacing: -0.01em;">${title}</h1>
              <p style="font-size: 13px; color: #6B6560; margin: 0;">Received on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </td>
          </tr>

          <!-- Client Details Grid -->
          <tr>
            <td style="padding: 28px 0 20px 0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="35%" style="padding: 8px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #756F68;">Client Name:</td>
                  <td width="65%" style="padding: 8px 0; font-size: 14.5px; font-weight: 500; color: #24211E;">${escapeHtml(data.name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #756F68;">Email Address:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #24211E;">
                    <a href="mailto:${escapeHtml(data.email)}" style="color: #24211E; text-decoration: underline;">${escapeHtml(data.email)}</a>
                  </td>
                </tr>
                ${data.phone ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #756F68;">Phone Number:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #24211E;">
                    <a href="tel:${escapeHtml(data.phone)}" style="color: #24211E; text-decoration: underline;">${escapeHtml(data.phone)}</a>
                  </td>
                </tr>` : ''}
                ${data.projectType ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #756F68;">Project Type:</td>
                  <td style="padding: 8px 0; font-size: 14px; font-weight: 500; color: #24211E;">${escapeHtml(data.projectType)}</td>
                </tr>` : ''}
                ${data.budget ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #756F68;">Budget Range:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #24211E;">${escapeHtml(data.budget)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Message Section -->
          <tr>
            <td style="background-color: #FAF7F2; border: 1px solid rgba(36, 33, 30, 0.08); padding: 20px 24px; margin-top: 10px;">
              <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #756F68; display: block; margin-bottom: 8px;">Project Vision &amp; Message:</span>
              <p style="font-size: 14px; line-height: 1.68; color: #24211E; margin: 0; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
            </td>
          </tr>

          <!-- Metadata Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid rgba(36, 33, 30, 0.10); font-size: 11px; color: #8A847E; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">Inquiry ID: #${data.id || 'N/A'} &middot; Client IP: ${escapeHtml(data.ipAddress || 'unknown')}</p>
              <p style="margin: 0;">MUHAR STUDIO &middot; Interior Architecture &middot; Noida, India</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * HTML Escape Helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send inquiry email notification
 * @param {Object} data
 * @returns {Promise<{success: boolean, simulated?: boolean, error?: string}>}
 */
async function sendInquiryNotification(data) {
  const isConsultation = data.type === 'consultation';
  const subject = `[MUHAR STUDIO] ${isConsultation ? 'Consultation Request' : 'New Inquiry'} from ${data.name}`;

  if (!config.smtp.isConfigured() || !transporter) {
    console.log('\n------------------------------------------------------------');
    console.log('✉️  [SIMULATED EMAIL NOTIFICATION] (SMTP not configured)');
    console.log(`To: ${config.smtp.notificationEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${data.name} <${data.email}>`);
    if (data.projectType) console.log(`Project: ${data.projectType} (${data.budget || 'N/A'})`);
    console.log(`Message: ${data.message}`);
    console.log('------------------------------------------------------------\n');
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to: config.smtp.notificationEmail,
      replyTo: `${data.name} <${data.email}>`,
      subject: subject,
      html: buildAdminEmailHtml(data),
      text: `New Inquiry from ${data.name} (${data.email}):\n\nPhone: ${data.phone || 'N/A'}\nProject: ${data.projectType || 'N/A'}\nBudget: ${data.budget || 'N/A'}\n\nMessage:\n${data.message}`
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Failed to send email notification:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendInquiryNotification
};
