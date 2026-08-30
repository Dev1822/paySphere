const Handlebars = require('handlebars');
const crypto = require('crypto');
const LetterTemplate = require('../models/letterTemplate.model');
const GeneratedLetter = require('../models/generatedLetter.model');
const Employee = require('../models/employee.model');
const Tenant = require('../models/tenant.model');
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

// Compile template safely
function renderTemplate(templateHtml, data) {
  try {
    const template = Handlebars.compile(templateHtml, { strict: false });
    return template(data);
  } catch (error) {
    logger.error('Handlebars compile error:', error);
    throw new Error('Failed to render template');
  }
}

// Compute SHA-256 Hash
function computeSealHash(employeeId, templateId, renderedHtml) {
  const payload = `${employeeId}-${templateId}-${renderedHtml}-${Date.now()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

class LetterTemplateService {
  async generateLetter(
    employeeId,
    templateId,
    metaVariables = {},
    reqUser = null,
  ) {
    const template = await LetterTemplate.findById(templateId);
    if (!template) throw new Error('Template not found');

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) throw new Error('Employee not found');

    let tenant = null;
    if (employee.tenantId) {
      tenant = await Tenant.findById(employee.tenantId).lean();
    } else if (reqUser && reqUser.tenantId) {
      tenant = await Tenant.findById(reqUser.tenantId).lean();
    }

    const dataContext = {
      employee,
      employer: tenant || {},
      company: tenant || {},
      meta: metaVariables,
    };

    const renderedHtml = renderTemplate(template.bodyHtml, dataContext);
    const sealHash = computeSealHash(employeeId, templateId, renderedHtml);

    const generatedLetter = new GeneratedLetter({
      templateId,
      employeeId,
      templateVersion: template.version,
      renderedHtml,
      sealHash,
      status: 'Pending',
      metadata: metaVariables,
    });

    await generatedLetter.save();

    // Trigger PDF generation asynchronously
    this._queuePdfGeneration(generatedLetter._id, renderedHtml, dataContext);

    return generatedLetter;
  }

  async bulkGenerate(
    employeeIds,
    templateId,
    metaVariables = {},
    reqUser = null,
  ) {
    const results = {
      total: employeeIds.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const empId of employeeIds) {
      try {
        await this.generateLetter(empId, templateId, metaVariables, reqUser);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ employeeId: empId, error: error.message });
      }
    }

    return results;
  }

  _queuePdfGeneration(generatedLetterId, html, dataContext) {
    // We send a message to pdf.worker.js
    const workerPath = path.resolve(__dirname, '../workers/pdf.worker.js');
    const worker = new Worker(workerPath);

    worker.postMessage({
      type: 'GENERATE_HTML_PDF',
      payload: {
        generatedLetterId,
        html,
        context: dataContext,
      },
    });

    worker.on('message', async (message) => {
      if (message.success) {
        // In a real scenario, you'd upload message.pdfData to S3/Cloud Storage and save the URL
        await GeneratedLetter.findByIdAndUpdate(generatedLetterId, {
          status: 'Generated',
          pdfUrl: 'mock-url-for-now.pdf', // TODO: Upload to storage
        });
      } else {
        await GeneratedLetter.findByIdAndUpdate(generatedLetterId, {
          status: 'Failed',
        });
        logger.error('PDF Worker failed to generate PDF:', message.error);
      }
    });

    worker.on('error', async (error) => {
      logger.error('PDF Worker threw an error:', error);
      await GeneratedLetter.findByIdAndUpdate(generatedLetterId, {
        status: 'Failed',
      });
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`PDF Worker stopped with exit code ${code}`);
      }
    });
  }
}

module.exports = new LetterTemplateService();
