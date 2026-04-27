const { Resend } = require('resend');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize Resend Client
const resend = new Resend(config.resendApiKey);

/**
 * Reusable Production Email Function (Resend API)
 * Includes exponential backoff retry logic
 */
const sendEmail = async (to, subject, text, html, attempt = 1) => {
  const MAX_ATTEMPTS = 3;
  
  try {
    // 🧪 DEV SIMULATION MODE 
    if (config.emailSimulationMode) {
      console.log('---------------------------------------------------------');
      console.log('📧 [SIMULATION] EMAIL DISPATCHED');
      console.log(`📍 To: ${to}`);
      console.log(`📍 Subject: ${subject}`);
      console.log(`📍 Body: ${text}`);
      console.log('---------------------------------------------------------');
      return true; 
    }

    if (!config.resendApiKey || config.resendApiKey === 're_123456789') {
      logger.error('❌ [CONFIG ERROR] Resend API Key is missing or default placeholder.');
      return false;
    }

    const { data, error } = await resend.emails.send({
      from: config.resendFromEmail,
      to: [to],
      subject: subject,
      text: text,
      html: html,
    });

    if (error) {
      throw error;
    }

    logger.info(`[EMAIL SENT] Identity packet delivered via Resend to: ${to} (ID: ${data.id})`);
    return true;

  } catch (err) {
    logger.error(`[EMAIL FAILED] Attempt ${attempt} failed for ${to}:`, err.message);

    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s...
      logger.info(`🔄 Retrying email delivery in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendEmail(to, subject, text, html, attempt + 1);
    }

    logger.error(`❌ [CRITICAL] Email delivery permanently failed for ${to} after ${MAX_ATTEMPTS} attempts.`);
    return false;
  }
};

/**
 * Compatibility helper for existing logic
 */
const isConfigured = () => {
  if (config.emailSimulationMode) return true;
  return !!config.resendApiKey && config.resendApiKey !== 're_123456789';
};

module.exports = { sendEmail, isConfigured };
