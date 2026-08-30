const PayslipTemplate = require('../models/payslipTemplate.model');
const { assemblePayslipData } = require('../utils/payslipDataAssembler');
const { renderPayslipPdf } = require('../utils/payslipRenderer.pdf');
const { renderPayslipHtml } = require('../utils/payslipRenderer.html');
const qrcode = require('qrcode');
const { sealDocument } = require('./cryptographicSeal.service');

async function generatePayslip(payload, format = 'pdf') {
  const { employee, payroll, tenantId } = payload;

  let template = await PayslipTemplate.findOne({ tenantId });
  if (!template) {
    // Fallback to a default template layout
    template = new PayslipTemplate({ tenantId });
  }

  const assembledData = assemblePayslipData(employee, payroll, template);

  if (template.footerOptions?.showQrCode) {
    try {
      const seal = await sealDocument({
        tenantId: tenantId,
        employeeId: employee._id || employee.employeeId,
        documentType: 'PAYSLIP',
        documentContent: JSON.stringify(assembledData),
        signedBy: 'SYSTEM',
      });
      // Create verification URL
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-payslip?hash=${seal.documentHash}`;
      assembledData.qrCodeDataUrl = await qrcode.toDataURL(verificationUrl);
    } catch (e) {
      console.error('Failed to generate cryptographic seal or QR code', e);
    }
  }

  if (format === 'html') {
    return renderPayslipHtml(assembledData, payload.currency);
  }

  const pdfOptions = {};
  if (template.security?.passwordStrategy === 'DOB' && employee.dob) {
    // e.g. 1990-01-01 -> 01011990
    const dob = new Date(employee.dob);
    const password = `${String(dob.getDate()).padStart(2, '0')}${String(dob.getMonth() + 1).padStart(2, '0')}${dob.getFullYear()}`;
    pdfOptions.userPassword = password;
  } else if (template.security?.passwordStrategy === 'PAN' && employee.pan) {
    pdfOptions.userPassword = employee.pan;
  }

  return new Promise((resolve, reject) => {
    try {
      const { Worker } = require('worker_threads');
      const path = require('path');
      const pdfWorker = new Worker(
        path.join(__dirname, '../workers/pdf.worker.js'),
      );

      pdfWorker.postMessage({
        type: 'GENERATE_DYNAMIC_PAYSLIP',
        payload: { assembledData, currency: payload.currency, pdfOptions },
      });

      pdfWorker.on('message', (result) => {
        if (result.success) {
          resolve(Buffer.from(result.pdfData));
        } else {
          reject(new Error('PDF Generation failed: ' + result.error));
        }
        pdfWorker.terminate();
      });

      pdfWorker.on('error', (err) => {
        reject(err);
        pdfWorker.terminate();
      });

      pdfWorker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`PDF worker exited unexpectedly with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePayslip };
