const nodemailer = require("nodemailer");

/**
 * Sends an email using Nodemailer. If SMTP variables are missing,
 * logs the details to the console as a local testing fallback.
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const isSmtpConfigured = 
    process.env.SMTP_HOST && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASS;

  if (!isSmtpConfigured) {
    console.log("\n====================================================================");
    console.log("📬 [EMAIL LOG FALLBACK] - SMTP not configured.");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("--------------------------------------------------------------------");
    console.log(`Text:\n${text}`);
    if (html) {
      console.log("--------------------------------------------------------------------");
      console.log(`HTML:\n${html}`);
    }
    console.log("====================================================================\n");
    return { success: true, logged: true };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"PaySphere" <no-reply@paysphere.com>',
    to,
    subject,
    text,
    html,
  };

  await transporter.sendMail(mailOptions);
  return { success: true, logged: false };
};

module.exports = { sendEmail };
