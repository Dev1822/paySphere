const axios = require('axios');
const logger = require('./logger');

const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const frontendUrl = process.env.FRONTEND_URL;

  const formattedAttachments = attachments?.map((att) => {
    let contentBase64 = att.content;
    if (Buffer.isBuffer(att.content)) {
      contentBase64 = att.content.toString('base64');
    }
    return {
      filename: att.filename,
      content: contentBase64,
    };
  });

  if (!frontendUrl) {
    logger.info('Email fallback - FRONTEND_URL not configured', { to, subject, attachmentCount: formattedAttachments?.length || 0 });
    return { success: false, logged: true, reason: 'FRONTEND_URL not configured' };
  }

  const proxyUrl = `${frontendUrl.replace(/\/+$/, '')}/api/send-email`;
  const secret = process.env.EMAIL_PROXY_SECRET;
  const headers = {};
  if (secret) {
    headers['Authorization'] = `Bearer ${secret}`;
  }

  try {
    const response = await axios.post(proxyUrl, {
      to,
      subject,
      text,
      html,
      attachments: formattedAttachments,
    }, { headers });

    if (response.status === 200) {
      logger.info(`Email proxied to Vercel for ${to}`, { to, subject });
      return { success: true, proxied: true };
    }

    throw new Error(`Unexpected response status: ${response.status}`);
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    logger.warn('Email Vercel proxy unavailable, falling back to console', { to, subject, reason: message });
    return { success: false, logged: true, reason: message };
  }
};

module.exports = { sendEmail };
