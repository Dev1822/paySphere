const PDFDocument = require('pdfkit');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

class ReportingService {
  /**
   * Generates a streaming Annual Consolidated Payroll Summary PDF.
   * This streams data directly from MongoDB cursors into the PDFKit document,
   * completely bypassing heavy RAM buffering of the entire result set.
   *
   * @param {Object} params
   * @param {string} params.tenantId - The tenant's ID
   * @param {number} params.year - The reporting year
   * @param {stream.Writable} outputStream - A writable stream (e.g., HTTP response or fs.WriteStream)
   */
  static async generateAnnualConsolidatedPayrollPDF({ tenantId, year }, outputStream) {
    if (!tenantId || !year) {
      throw new Error('tenantId and year are required to generate the annual summary.');
    }
    if (!outputStream) {
      throw new Error('outputStream is required.');
    }

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Pipe the PDF output to the provided writable stream immediately
    doc.pipe(outputStream);

    doc.fontSize(20).text(`Annual Consolidated Payroll Summary - ${year}`, { align: 'center' });
    doc.moveDown(2);

    let employeeCount = 0;
    
    try {
      // Use MongoDB .cursor() instead of .lean() to prevent loading everything into memory.
      // This solves the OOM memory leak by streaming records one by one from the database.
      const cursor = PayrollUpdate.find({ tenantId, year })
        .sort({ employeeName: 1, month: 1 })
        .cursor();

      for await (const payroll of cursor) {
        // Render each payroll record sequentially directly into the PDF
        doc.fontSize(12).text(`Employee: ${payroll.employeeName} (${payroll.employeeId})`);
        doc.fontSize(10).text(`Month: ${payroll.month}`);
        doc.fontSize(10).text(`Status: ${payroll.status}`);
        
        const netSalary = payroll.calculationSnapshot?.netSalary ?? payroll.netSalary ?? 0;
        doc.fontSize(10).text(`Net Paid: $${netSalary.toLocaleString()}`);
        doc.moveDown(1);
        
        employeeCount++;

        // Add a new page every 20 records to keep it clean
        if (employeeCount % 20 === 0) {
          doc.addPage();
        }
      }

      // Finalize the PDF file
      doc.end();

      eventBus.emit('AUDIT_LOG', {
        action: 'REPORT_DOWNLOAD',
        resourceType: 'Report',
        details: {
          year,
          type: 'annual-consolidated-payroll-pdf',
          employeeCount,
          streamed: true,
        },
      });

      logger.info(`Streamed Annual Consolidated Payroll Summary PDF successfully`, {
        tenantId,
        year,
        employeeCount,
      });

    } catch (error) {
      logger.error('Error during streaming PDF report generation', { error, tenantId, year });
      // Clean up the PDF stream on failure
      doc.end();
      throw error;
    }
  }
}

module.exports = ReportingService;
