const PDFDocument = require('pdfkit');
const { formatCurrency } = require('./currency');

function renderPayslipPdf(assembledData, currency = 'INR', pdfOptions = {}) {
  const { branding, sections } = assembledData;
  const primaryColor = branding?.primaryColor || '#3b82f6';

  // Apply password protection if needed
  const doc = new PDFDocument({ margin: 50, ...pdfOptions });

  // We'll return a promise that resolves with the PDF buffer
  return new Promise((resolve, reject) => {
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    if (branding?.logoUrl) {
      try {
        const logoBuffer = Buffer.from(
          branding.logoUrl.replace(/^data:image\/\w+;base64,/, ''),
          'base64',
        );
        doc.image(logoBuffer, 50, 40, { fit: [50, 50] });
      } catch (e) {
        // Ignore logo errors
      }
    }

    doc.moveDown(2);

    sections.forEach((section) => {
      if (section.title) {
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .text(section.title, { underline: true });
        doc.moveDown(0.5);
      }
      doc.fillColor('#000000'); // Reset color

      if (section.id === 'header') {
        doc.fontSize(14).text(section.content.companyName, { align: 'center' });
        doc
          .fontSize(10)
          .text(
            `Payslip for ${section.content.payslipMonth} ${section.content.payslipYear}`,
            { align: 'center' },
          );
        doc.moveDown();
      } else if (section.id === 'employeeDetails') {
        doc
          .fontSize(10)
          .text(
            `Name: ${section.content.fullName} | ID: ${section.content.employeeId}`,
          );
        doc.text(
          `Role: ${section.content.role} | Department: ${section.content.department}`,
        );
        doc.moveDown();
      } else if (section.id === 'earnings') {
        doc.text(
          `Base Salary: ${formatCurrency(section.content.baseSalary, currency)}`,
        );
        doc.text(
          `Overtime: ${formatCurrency(section.content.overtimePay, currency)}`,
        );
        doc.text(`Bonus: ${formatCurrency(section.content.bonus, currency)}`);
        doc.text(
          `Reimbursements: ${formatCurrency(section.content.reimbursements, currency)}`,
        );
        doc
          .font('Helvetica-Bold')
          .text(
            `Total Earnings: ${formatCurrency(section.content.totalEarnings, currency)}`,
          );
        doc.font('Helvetica').moveDown();
      } else if (section.id === 'deductions') {
        doc.text(
          `Leave Deduction: ${formatCurrency(section.content.leaveDeduction, currency)}`,
        );
        doc.text(
          `Tax Deduction: ${formatCurrency(section.content.taxDeduction, currency)}`,
        );
        doc.text(
          `Other Deductions: ${formatCurrency(section.content.otherDeductions, currency)}`,
        );
        doc
          .font('Helvetica-Bold')
          .text(
            `Total Deductions: ${formatCurrency(section.content.totalDeductions, currency)}`,
          );
        doc.font('Helvetica').moveDown();
      } else if (section.id === 'netPay') {
        doc
          .fontSize(14)
          .fillColor(primaryColor)
          .text(
            `Net Pay: ${formatCurrency(section.content.netSalary, currency)}`,
            { align: 'center' },
          );
        doc.moveDown();
      } else if (section.id === 'footer') {
        doc
          .fontSize(8)
          .fillColor('#666666')
          .text(section.content.customText, { align: 'center' });
      }
    });

    // Add QR Code at the bottom if configured
    if (
      assembledData.footerOptions?.showQrCode &&
      assembledData.qrCodeDataUrl
    ) {
      try {
        const qrBuffer = Buffer.from(
          assembledData.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, ''),
          'base64',
        );
        doc.image(qrBuffer, 50, doc.y + 20, { fit: [60, 60] });
        doc.text('Scan to verify', 120, doc.y + 45);
      } catch (e) {
        // ignore
      }
    }

    doc.end();
  });
}

module.exports = { renderPayslipPdf };
