const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

exports.sendPayslipEmail = async (employee, payroll) => {
  if (!employee.email) {
    logger.warn(`No email found for employee`, { employeeName: employee.fullName });
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const { Worker } = require("worker_threads");
      const path = require("path");

      const pdfWorker = new Worker(path.join(__dirname, "../workers/pdf.worker.js"));
      
      pdfWorker.postMessage({
        type: "GENERATE_PAYSLIP",
        payload: { employee, payroll }
      });

      pdfWorker.on("message", async (result) => {
        if (result.success) {
          const pdfData = Buffer.from(result.pdfData);

          const mailOptions = {
            from: process.env.EMAIL_FROM || '"PaySphere" <no-reply@paysphere.com>',
            to: employee.email,
            subject: `Payslip for ${payroll.month}/${payroll.year}`,
            text: `Hello ${employee.fullName},\n\nPlease find attached your payslip for ${payroll.month}/${payroll.year}.\n\nBest Regards,\nPaySphere Team`,
            attachments: [
              {
                filename: `Payslip_${payroll.month}_${payroll.year}.pdf`,
                content: pdfData,
              },
            ],
          };

          try {
            const info = await sendEmail(mailOptions);
            logger.info(`Payslip email sent to ${employee.email}`);
            resolve(info);
          } catch (err) {
            logger.error('Error sending email', { error: err.message, employee: employee.email });
            reject(err);
          }
        } else {
          reject(new Error("PDF Generation failed: " + result.error));
        }
        pdfWorker.terminate();
      });

      pdfWorker.on("error", (err) => {
        reject(err);
        pdfWorker.terminate();
      });
    } catch (error) {
      logger.error('Error generating PDF', { error: error.message });
      reject(error);
    }
  });
};
