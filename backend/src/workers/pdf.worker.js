const { workerData, parentPort } = require('worker_threads');
const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../utils/currency');
const logger = require('../utils/logger');
const { translate, normalizeLanguage } = require('../utils/i18n');

/**
 * Color palettes for the two report themes (#1288).
 *
 * pdfkit has no notion of a page background — by default it's just
 * whatever the paper color is (white). Dark mode paints an explicit
 * rect behind every page and swaps every hardcoded light-mode color to
 * one that still reads clearly on that dark background.
 */
const REPORT_THEMES = {
  light: {
    background: '#ffffff',
    heading: '#1e3a5f',
    subheading: '#666666',
    sectionTitle: '#333333',
    label: '#555555',
    value: '#1e3a5f',
    divider: '#cccccc',
    tableHeaderBg: '#e8edf3',
    tableHeaderText: '#333333',
    rowAltBg: '#f9fafb',
    rowText: '#444444',
    footer: '#aaaaaa',
  },
  dark: {
    background: '#0f172a',
    heading: '#93c5fd',
    subheading: '#94a3b8',
    sectionTitle: '#e2e8f0',
    label: '#cbd5e1',
    value: '#93c5fd',
    divider: '#334155',
    tableHeaderBg: '#1e293b',
    tableHeaderText: '#e2e8f0',
    rowAltBg: '#111827',
    rowText: '#cbd5e1',
    footer: '#64748b',
  },
};

/** Falls back to light for anything that isn't exactly "dark". */
function resolveTheme(theme) {
  return REPORT_THEMES[theme] || REPORT_THEMES.light;
}
/**
 * Generates Form 16 (Part A & Part B) PDF
 * @param {Object} payload - { employee, employer, fyStartYear }
 */
async function handleForm16Generation(payload) {
  const { employee, employer, fyStartYear } = payload;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    parentPort.postMessage({ success: true, pdfData: Buffer.concat(buffers) });
  });

  const drawTable = (startY, headers, rows) => {
    let y = startY;
    const colWidth = 250;

    // Header
    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => {
      doc.text(h, 50 + i * colWidth, y, { width: colWidth, align: 'left' });
    });
    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke('#000');
    y += 5;

    // Rows
    doc.font('Helvetica').fontSize(9);
    rows.forEach((row) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      row.forEach((cell, i) => {
        doc.text(String(cell), 50 + i * colWidth, y, {
          width: colWidth,
          align: i === 1 ? 'right' : 'left',
        });
      });
      y += 15;
    });
    return y;
  };

  // --- PART A ---
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('FORM NO. 16', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('[See Rule 31]', { align: 'center' });
  doc.moveDown(0.5);
  doc.text(
    'Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source',
    { align: 'center' },
  );
  doc.moveDown(1);

  doc.fontSize(12).font('Helvetica-Bold').text(`PART A`);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Name and address of the employer: ${employer.companyName}`);
  doc.text(`TAN of the employer: ${employer.tan}`);
  doc.text(`PAN of the employer: ${employer.pan}`);
  doc.moveDown(0.5);
  doc.text(`Name and address of the employee: ${employee.employeeName}`);
  doc.text(`PAN of the employee: ${employee.pan}`);
  doc.moveDown(0.5);
  doc.text(
    `Assessment Year: ${fyStartYear + 1}-${String(fyStartYear + 2).slice(-2)}`,
  );
  doc.text(`Financial Year: ${fyStartYear}-${fyStartYear + 1}`);

  doc.moveDown(2);

  // --- PART B ---
  doc.addPage();
  doc.fontSize(12).font('Helvetica-Bold').text('PART B (Annexure II)');
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text('Details of salary and tax deducted at source');
  doc.moveDown(1);

  const headers = ['Description', 'Amount (₹)'];
  const rows = [
    ['Gross Salary (Section 17(1))', employee.grossSalary],
    ['Perquisites (Section 17(2))', employee.perquisites],
    ['Profits in lieu of salary (Section 17(3))', 0],
    ['Total Gross Income', employee.grossSalary + employee.perquisites],
    ['Less: Standard Deduction (Section 16(ia))', 50000],
    ['Less: Professional Tax', employee.professionalTax],
    ['Net Taxable Income', employee.netTaxableIncome],
    ['Total Tax Deducted at Source (TDS)', employee.totalTDS],
  ];

  drawTable(doc.y, headers, rows);

  doc.moveDown(3);
  doc
    .fontSize(10)
    .font('Helvetica')
    .text('This is to certify that the information given above is correct.', {
      align: 'center',
    });
  doc.moveDown(2);
  doc.text('___________________________', 400, doc.y);
  doc.text('Authorized Signatory', 420, doc.y + 5);

  doc.end();
}

/**
 * Generates company-wide payroll summary report PDF
 */
async function handleCompanyReportGeneration(payload) {
  const {
    payrolls,
    employeeMap,
    companyName,
    companyLogo,
    monthName,
    year,
    totalBase,
    totalOvertime,
    totalBonus,
    totalDeductions,
    totalPayout,
    currency = 'INR',
    theme,
  } = payload;
  const palette = resolveTheme(theme);

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    parentPort.postMessage({ success: true, pdfData });
  });

  // Dark mode has no "paper white" to fall back on, so every page gets an
  // explicit background rect — including ones added later by the table's
  // pagination below.
  const paintPageBackground = () => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(palette.background);
  };
  if (palette.background !== '#ffffff') {
    paintPageBackground();
    doc.on('pageAdded', paintPageBackground);
  }

  // --- Company Header ---
  if (companyLogo) {
    try {
      const logoBuffer = Buffer.from(
        companyLogo.replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      );
      doc.image(logoBuffer, 40, 30, { fit: [50, 50] });
    } catch (error) {
      logger.error(
        'PDF logo rendering failed in handleCompanyReportGeneration',
        { error: error.message || error },
      );
    }
  }
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor(palette.heading)
    .text(companyName, { align: 'center' });
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor(palette.subheading)
    .text(`Payroll Summary Report — ${monthName} ${year}`, { align: 'center' });
  doc.moveDown(0.5);

  // Divider line
  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .strokeColor(palette.divider)
    .lineWidth(1)
    .stroke();
  doc.moveDown(1);

  // --- Summary Section ---
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor(palette.sectionTitle)
    .text('Financial Summary');
  doc.moveDown(0.3);

  const summaryData = [
    ['Total Employees', String(payrolls.length)],
    ['Total Base Salary', formatCurrency(totalBase, currency)],
    ['Total Overtime Pay', formatCurrency(totalOvertime, currency)],
    ['Total Bonuses', formatCurrency(totalBonus, currency)],
    ['Total Deductions', formatCurrency(totalDeductions, currency)],
    ['Net Payout', formatCurrency(totalPayout, currency)],
  ];

  summaryData.forEach(([label, value]) => {
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(palette.label)
      .text(label, 60, doc.y, { continued: true, width: 200 });
    doc
      .font('Helvetica-Bold')
      .fillColor(palette.value)
      .text(`  ${value}`, { align: 'right' });
    doc.moveDown(0.2);
  });

  doc.moveDown(1);

  // --- Employee Payroll Table ---
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor(palette.sectionTitle)
    .text('Employee Payroll Details');

  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const colWidths = [110, 65, 55, 60, 55, 55, 65];
  const colLabels = [
    'Employee',
    'Base',
    'Leave',
    'Overtime',
    'Bonus',
    'Deduct',
    'Net Pay',
  ];
  const startX = 40;

  // Header background
  doc.rect(startX, tableTop - 4, 515, 18).fill(palette.tableHeaderBg);

  let xPos = startX + 5;
  colLabels.forEach((label, i) => {
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor(palette.tableHeaderText)
      .text(label, xPos, tableTop, { width: colWidths[i] });
    xPos += colWidths[i];
  });

  doc.y = tableTop + 18;

  // Table rows
  payrolls.forEach((p, idx) => {
    if (doc.y > 750) {
      doc.addPage();
    }

    const rowY = doc.y;
    const emp = employeeMap[String(p.employeeId)];
    const role = emp?.role ? ` (${emp.role})` : '';

    // Alternating row background
    if (idx % 2 === 0) {
      doc.rect(startX, rowY - 2, 515, 14).fill(palette.rowAltBg);
    }

    const rowData = [
      `${p.employeeName}${role}`,
      formatCurrency(p.baseSalary, currency),
      String(p.leaveDays),
      formatCurrency(p.overtimePay, currency),
      formatCurrency(p.bonus, currency),
      formatCurrency(p.deductions + p.leaveDeduction, currency),
      formatCurrency(p.netSalary, currency),
    ];

    xPos = startX + 5;
    rowData.forEach((cell, i) => {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(palette.rowText)
        .text(cell, xPos, rowY, { width: colWidths[i] });
      xPos += colWidths[i];
    });

    doc.y = rowY + 14;
  });

  doc.moveDown(0.5);
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + 515, doc.y)
    .strokeColor(palette.divider)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(palette.value)
    .text(
      `Total Payout: ${formatCurrency(totalPayout, currency)}`,
      startX,
      doc.y,
      { align: 'right' },
    );

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(palette.footer)
      .text(
        `Generated by PaySphere • Page ${i + 1} of ${pageCount}`,
        40,
        doc.page.height - 30,
        { align: 'center', width: 515 },
      );
  }

  doc.end();
}
/**
 * Generates individual employee payslip PDF
 */
async function handlePayslipGeneration(payload) {
  const {
    employee,
    payroll,
    companyLogo,
    currency = 'INR',
    language = employee?.language || 'en',
  } = payload;
  const locale = normalizeLanguage(language);
  const t = (key, variables) => translate(locale, key, variables);

  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    parentPort.postMessage({ success: true, pdfData });
  });

  // Build PDF content
  if (companyLogo) {
    try {
      const logoBuffer = Buffer.from(
        companyLogo.replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      );
      doc.image(logoBuffer, 50, 40, { fit: [50, 50] });
    } catch (error) {
      logger.error('PDF logo rendering failed in handlePayslipGeneration', {
        error: error.message || error,
      });
    }
  }
  doc.fontSize(20).text('PaySphere', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).text(t('payslipTitle', payroll), { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(12).text(`${t('employeeName')}: ${employee.fullName}`);
  doc.text(`${t('role')}: ${employee.role || t('notAvailable')}`);
  doc.text(`${t('company')}: ${employee.companyName}`);
  doc.moveDown();

  doc.text(
    `${t('baseSalary')}: ${formatCurrency(payroll.baseSalary, currency)}`,
  );
  doc.text(
    `${t('leaveDays')}: ${payroll.leaveDays} (-${formatCurrency(payroll.leaveDeduction, currency)})`,
  );
  doc.text(
    `${t('overtimeHours')}: ${payroll.overtimeHours} (+${formatCurrency(payroll.overtimePay, currency)})`,
  );
  doc.text(`${t('bonus')}: +${formatCurrency(payroll.bonus || 0, currency)}`);
  doc.text(
    `${t('deductions')}: -${formatCurrency(payroll.deductions || 0, currency)}`,
  );

  // Issue #719: Render tax-free reimbursements distinctly
  if (payroll.reimbursements && payroll.reimbursements > 0) {
    doc.moveDown(0.5);
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#2563EB')
      .text(t('reimbursements'));
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text(
      `${t('expenseReimbursements')}: +${formatCurrency(payroll.reimbursements, currency)}`,
    );
  }

  doc.moveDown(1);

  doc
    .fontSize(14)
    .text(`${t('netSalary')}: ${formatCurrency(payroll.netSalary, currency)}`, {
      underline: true,
    });
  doc.end();
}

/**
 * Generates PDF from HTML (mock for Document Template Engine)
 */
async function handleHtmlPdfGeneration(payload) {
  const { generatedLetterId, html, context } = payload;
  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    parentPort.postMessage({ success: true, pdfData, generatedLetterId });
  });

  // Mock rendering HTML to PDF
  doc.fontSize(20).text('Generated Document', { align: 'center' });
  doc.moveDown();
  doc
    .fontSize(12)
    .text(
      'Note: Full HTML to PDF rendering requires a specialized library like Puppeteer.',
    );
  doc.moveDown();
  // Strip simple HTML tags for a very basic representation
  const plainText = html
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
  doc.fontSize(10).text(plainText);

  doc.end();
}

async function processPdfEvent(event, payload) {
  switch (event) {
    case 'PdfGeneration':
    case 'GENERATE_COMPANY_REPORT':
      if (payload.type === 'company_report') {
        await handleCompanyReportGeneration(payload);
      } else {
        await handleCompanyReportGeneration(payload);
      }
      break;
    case 'GENERATE_PAYSLIP':
    case 'PayrollFinalized':
      if (payload.type === 'dynamic') {
        const { renderPayslipPdf } = require('../utils/payslipRenderer.pdf');
        const pdfData = await renderPayslipPdf(
          payload.assembledData,
          payload.currency,
          payload.pdfOptions,
        );
        if (parentPort) parentPort.postMessage({ success: true, pdfData });
        return pdfData;
      } else {
        await handlePayslipGeneration(payload);
      }
      break;
    case 'GENERATE_DYNAMIC_PAYSLIP': {
      const { renderPayslipPdf } = require('../utils/payslipRenderer.pdf');
      const pdfData = await renderPayslipPdf(
        payload.assembledData,
        payload.currency,
        payload.pdfOptions,
      );
      if (parentPort) parentPort.postMessage({ success: true, pdfData });
      return pdfData;
    }
    case 'GENERATE_FORM_16':
      await handleForm16Generation(payload);
      break;
    case 'GENERATE_HTML_PDF':
    case 'EmployeeOnboarded':
    case 'OffboardingInitiated':
      await handleHtmlPdfGeneration(payload);
      break;
    default:
      throw new Error(`Unknown PDF generation event: ${event}`);
  }
}

if (parentPort) {
  // Message-based worker entry point
  parentPort.on('message', async (msg) => {
    try {
      // Support both legacy msg.type and standard EDA msg.event
      const event = msg.event || msg.type;
      await processPdfEvent(event, msg.payload || msg);
    } catch (error) {
      parentPort.postMessage({ success: false, error: error.message });
    }
  });
}

// BullMQ Worker Integration
const { Worker: BullWorker } = require('bullmq');
const redisConnection = require('../config/redis');

async function processPdfJob(job) {
  const { event, payload } = job.data;
  logger.info(`Processing PDF job for event: ${event}`);
  try {
    await processPdfEvent(event, payload);
    return { generated: true };
  } catch (error) {
    logger.error(`PDF Job failed for event: ${event}`, {
      error: error.message,
    });
    throw error;
  }
}

let bullWorker = null;

function startPdfWorker() {
  if (bullWorker) return bullWorker;

  bullWorker = new BullWorker('pdf-generation', processPdfJob, {
    connection: redisConnection,
    concurrency: 3,
  });

  bullWorker.on('completed', (job) => {
    logger.debug(`PDF job ${job.id} completed successfully`);
  });

  bullWorker.on('failed', (job, err) => {
    logger.error(`PDF job ${job?.id} failed`, { error: err.message });
  });

  logger.info('PDF worker started', { queue: 'pdf-generation' });
  return bullWorker;
}

async function stopPdfWorker() {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
  }
}

module.exports = { startPdfWorker, stopPdfWorker, processPdfJob };
