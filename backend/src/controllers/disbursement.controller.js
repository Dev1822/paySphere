/**
 * @fileoverview Disbursement Controller
 * @description Manages bank mappings, NACHA originator configs, and file generation.
 * Issue: #1733
 */
const {
  BankAccountMapping,
  NACHABatchConfiguration,
  DisbursementFile,
} = require('../models/bankDisbursement.model');
const Employee = require('../models/employee.model');
const {
  generateFileHeader,
  generateBatchHeader,
  generateEntryDetail,
  generateBatchControl,
  generateFileControl,
  validateBalancing,
} = require('../utils/nachaGenerationEngine.utils');
const logger = require('../utils/logger');

exports.configureOriginator = async (req, res, next) => {
  try {
    const config = await NACHABatchConfiguration.findOneAndUpdate(
      { tenantId: req.tenantId },
      { ...req.body, tenantId: req.tenantId },
      { upsert: true, new: true },
    );
    res.status(200).json({ message: 'NACHA originator configured', config });
  } catch (error) {
    next(error);
  }
};

exports.mapEmployeeBank = async (req, res, next) => {
  try {
    const {
      employeeId,
      accountNickname,
      routingNumber,
      accountNumber,
      accountType,
      splitPercentage,
      priority,
    } = req.body;

    const mapping = await BankAccountMapping.create({
      tenantId: req.tenantId,
      employeeId,
      accountNickname,
      routingNumber,
      accountNumber,
      accountType,
      splitPercentage,
      priority,
    });

    res.status(201).json({ message: 'Bank account mapped', mapping });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/disbursement/generate-nacha
 * Generates the fixed-width NACHA file for a finalized payroll batch.
 * Expects: { payrollRunId, employeePayouts: [{ employeeId, netPay }] }
 */
exports.generateNachaFile = async (req, res, next) => {
  try {
    const { payrollRunId, employeePayouts, effectiveDate } = req.body;
    const config = await NACHABatchConfiguration.findOne({
      tenantId: req.tenantId,
    });
    if (!config)
      return res
        .status(400)
        .json({ message: 'NACHA originator not configured.' });

    const creationDate = new Date();
    const effDate = new Date(effectiveDate);

    let fileContent = generateFileHeader(config, creationDate) + '\n';

    const batchNumber = 1;
    const batchHeader = generateBatchHeader(config, effDate, batchNumber);
    fileContent += batchHeader + '\n';

    let totalCreditCents = 0;
    let entryCount = 0;
    const entryDetails = [];

    for (const payout of employeePayouts) {
      const bankMappings = await BankAccountMapping.find({
        tenantId: req.tenantId,
        employeeId: payout.employeeId,
        prenoteStatus: 'Approved',
      }).sort({ priority: 1 });

      if (bankMappings.length === 0) {
        logger.warn(
          `[NACHA] No approved bank mapping for employee ${payout.employeeId}. Generating paper check.`,
        );
        continue;
      }

      // Handle split deposits
      let remainingCents = Math.round(payout.netPay * 100);

      for (let i = 0; i < bankMappings.length; i++) {
        const bank = bankMappings[i];
        let amountCents;

        if (i === bankMappings.length - 1) {
          // Last account gets the remainder to avoid rounding penny discrepancies
          amountCents = remainingCents;
        } else {
          amountCents = Math.round(
            payout.netPay * (bank.splitPercentage / 100) * 100,
          );
          remainingCents -= amountCents;
        }

        if (amountCents <= 0) continue;

        entryCount++;
        const traceNumber =
          config.immediateOrigin.substring(0, 8) +
          String(entryCount).padStart(7, '0');
        const entryLine = generateEntryDetail(
          bank,
          amountCents,
          traceNumber,
          entryCount,
        );

        fileContent += entryLine + '\n';
        totalCreditCents += amountCents;
        entryDetails.push({ routingNumber: bank.routingNumber, amountCents });
      }
    }

    // Generate Batch Control
    const batchControl = generateBatchControl(
      {
        companyIdentification: config.companyIdentification,
        immediateOrigin: config.immediateOrigin,
      },
      entryDetails,
      totalCreditCents,
      batchNumber,
    );
    fileContent += batchControl + '\n';

    // Generate File Control
    const fileControl = generateFileControl(
      [{ entries: entryDetails }],
      entryCount,
      totalCreditCents,
    );
    fileContent += fileControl + '\n';

    // Pad the final file to a multiple of 10 lines (940 chars) with '9's (Record Type 9 padding)
    const lines = fileContent.split('\n').filter((l) => l.length > 0);
    const remainder = lines.length % 10;
    if (remainder !== 0) {
      const padLines = 10 - remainder;
      for (let i = 0; i < padLines; i++) {
        fileContent += '9'.repeat(94) + '\n';
      }
    }

    // Balancing Guardrail
    const balanceCheck = validateBalancing(
      totalCreditCents / 100,
      totalCreditCents / 100,
    );
    if (!balanceCheck.isBalanced) {
      throw new Error(
        `File Balancing Guardrail Triggered: Discrepancy of $${balanceCheck.discrepancy}`,
      );
    }

    const fileName = `NACHA_PPD_${creationDate.toISOString().split('T')[0]}_${batchNumber}.txt`;
    const disbursement = await DisbursementFile.create({
      tenantId: req.tenantId,
      payrollRunId,
      fileName,
      fileContent,
      batchCount: 1,
      entryCount,
      totalCreditAmount: totalCreditCents / 100,
      generatedBy: req.userId,
    });

    logger.info(
      `[NACHA] Generated file ${fileName} with ${entryCount} entries.`,
    );
    res
      .status(201)
      .json({ message: 'NACHA file generated successfully', disbursement });
  } catch (error) {
    next(error);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const config = await NACHABatchConfiguration.findOne({
      tenantId: req.tenantId,
    });
    const files = await DisbursementFile.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(20);
    const mappings = await BankAccountMapping.find({ tenantId: req.tenantId })
      .populate('employeeId', 'fullName')
      .sort({ 'employeeId.fullName': 1, priority: 1 });

    res.status(200).json({ config, files, mappings });
  } catch (error) {
    next(error);
  }
};

exports.downloadFile = async (req, res, next) => {
  try {
    const file = await DisbursementFile.findOne({
      _id: req.params.fileId,
      tenantId: req.tenantId,
    });
    if (!file) return res.status(404).json({ message: 'File not found' });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.fileContent);
  } catch (error) {
    next(error);
  }
};

/**
 * @fileoverview Salary disbursement batch endpoints.
 * @description Issue: #1075
 *
 * The order of operations here is the feature. A batch is *built* from a payroll
 * month, then *validated* against the bank's rules, then *released*, then
 * *reconciled* against the bank's return file. Each step has a refusal attached
 * to it, and the refusals are the reason the endpoints exist:
 *
 *   - build refuses a payroll month that has not been approved,
 *   - release refuses a batch with any rejected line, and is idempotent,
 *   - release refuses a batch whose contents have changed since validation,
 *   - reconcile refuses a return file that does not belong to the batch.
 *
 * Account numbers never appear in a JSON response. `DisbursementLine`'s `toJSON`
 * strips the field; the generators below read it explicitly because they are the
 * only callers that legitimately need it.
 */

const mongoose = require('mongoose');

const {
  DisbursementBatch,
  DisbursementLine,
} = require('../models/disbursementBatch.model');
const PayrollUpdate = require('../models/payroll.model');
const {
  BATCH_STATUS,
  LINE_STATUS,
  BANK_PROFILES,
  validateBatch,
  computeControlTotals,
  verifyControlTotals,
  generateDelimitedFile,
  generateNachFile,
  parseReturnFile,
  reconcileReturns,
  toRupees,
} = require('../utils/bankFileGenerator');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const eventBus = require('../services/event.service');

/**
 * Lines as the file generators want them, read straight from the database.
 *
 * Separate from the API-facing shape on purpose: this is the only path that
 * carries a full account number, and keeping it in one named function makes it
 * greppable.
 *
 * @param {string} tenantId
 * @param {string} batchId
 * @returns {Promise<Array<object>>}
 */
async function loadLinesForFile(tenantId, batchId) {
  return DisbursementLine.find({ tenantId, batchId })
    .sort({ serial: 1 })
    .lean();
}

/**
 * POST /api/disbursements/batches
 *
 * Builds a batch from an approved payroll month.
 *
 * Approved, not finalised: `submitPayrollForReview` puts a run into
 * `pending_approval`, and the whole point of #458's maker–checker split is that
 * money does not move on the maker's say-so. Generating a bank file from an
 * unapproved run would route around that.
 */
exports.createBatch = async (req, res, next) => {
  try {
    const {
      month,
      year,
      batchReference,
      debitAccountNumber,
      debitIfsc,
      debitAccountName,
      valueDate,
    } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }
    if (!debitAccountNumber || !debitIfsc) {
      return res
        .status(400)
        .json({ message: 'debitAccountNumber and debitIfsc are required' });
    }

    const payrolls = await PayrollUpdate.find({
      tenantId: req.tenantId,
      month: Number(month),
      year: Number(year),
      status: PAYROLL_STATUS.APPROVED,
    })
      .select('employeeId employeeName netSalary')
      .lean();

    if (payrolls.length === 0) {
      return res.status(409).json({
        message: `No approved payroll rows for ${month}/${year}. A run must be approved before it can be disbursed.`,
      });
    }

    const employees = await Employee.find({
      tenantId: req.tenantId,
      _id: { $in: payrolls.map((row) => row.employeeId) },
    })
      .select('fullName bankDetails')
      .lean();

    const bankByEmployee = new Map(
      employees.map((employee) => [String(employee._id), employee]),
    );

    const candidateLines = payrolls.map((row) => {
      const employee = bankByEmployee.get(String(row.employeeId));

      return {
        employeeId: row.employeeId,
        payrollId: row._id,
        beneficiaryName: employee?.fullName || row.employeeName,
        accountNumber: employee?.bankDetails?.accountNumber,
        // The employee schema calls it `routingCode` because it also carries
        // non-Indian employees. For an INR batch it is the IFSC.
        ifsc: employee?.bankDetails?.routingCode,
        amount: row.netSalary,
      };
    });

    const partition = validateBatch(candidateLines, { debitIfsc });
    const totals = computeControlTotals(partition.valid);

    const batch = await DisbursementBatch.create({
      tenantId: req.tenantId,
      batchReference:
        batchReference || `SAL${String(year)}${String(month).padStart(2, '0')}`,
      month: Number(month),
      year: Number(year),
      debitAccountNumber,
      debitIfsc,
      debitAccountName,
      valueDate: valueDate ? new Date(valueDate) : new Date(),
      status: BATCH_STATUS.DRAFT,
      controlTotals: totals,
      rejectedLines: partition.rejected,
      createdBy: req.userId,
    });

    if (partition.valid.length > 0) {
      await DisbursementLine.insertMany(
        partition.valid.map((line, index) => ({
          tenantId: req.tenantId,
          batchId: batch._id,
          employeeId: line.employeeId,
          payrollId: candidateLines[line.index]?.payrollId || null,
          serial: index + 1,
          beneficiaryName: line.beneficiaryName,
          accountNumber: line.accountNumber,
          maskedAccountNumber: line.maskedAccountNumber,
          ifsc: line.ifsc,
          amountPaise: line.amountPaise,
          paymentMode: line.paymentMode,
          paymentModeReason: line.paymentModeReason,
          status: LINE_STATUS.PENDING,
        })),
      );
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DISBURSEMENT_BATCH_CREATED',
      resourceType: 'DisbursementBatch',
      resourceIds: [batch._id],
      details: {
        month,
        year,
        accepted: partition.valid.length,
        rejected: partition.rejected.length,
        totalAmount: totals.totalAmount,
      },
      req,
    });

    return res.status(201).json({
      message: 'Batch built',
      batch,
      accepted: partition.valid.length,
      rejected: partition.rejected,
      duplicateAccounts: partition.valid.filter(
        (line) => line.duplicateOfIndex !== null,
      ).length,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          'A disbursement batch already exists for that period or reference',
      });
    }
    return next(error);
  }
};

/**
 * GET /api/disbursements/batches
 */
exports.getBatches = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.year) filter.year = Number(req.query.year);

    const batches = await DisbursementBatch.find(filter)
      .sort({ year: -1, month: -1 })
      .lean();

    return res.json({
      batches: batches.map((batch) => ({
        ...batch,
        totalAmount: toRupees(batch.controlTotals?.totalAmountPaise || 0),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/disbursements/batches/:id
 */
exports.getBatch = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await DisbursementBatch.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // Projected without `accountNumber` rather than relying on `toJSON`: `lean()`
    // returns plain objects, which never pass through the schema transform.
    const lines = await DisbursementLine.find({
      tenantId: req.tenantId,
      batchId: batch._id,
    })
      .select('-accountNumber')
      .sort({ serial: 1 })
      .lean();

    return res.json({
      batch,
      totalAmount: toRupees(batch.controlTotals?.totalAmountPaise || 0),
      lines: lines.map((line) => ({
        ...line,
        amount: toRupees(line.amountPaise),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/disbursements/batches/:id/validate
 *
 * Re-runs validation over the stored lines and refreshes the control totals.
 * Separate from the build so that a batch whose rejected lines have been fixed
 * — bank details corrected on the employee record — can be re-checked without
 * being rebuilt from scratch.
 */
exports.validateBatchLines = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await DisbursementBatch.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    if (
      batch.status === BATCH_STATUS.RELEASED ||
      batch.status === BATCH_STATUS.RECONCILED
    ) {
      return res.status(409).json({
        message: `Batch is already ${batch.status} and cannot be revalidated`,
      });
    }

    const lines = await loadLinesForFile(req.tenantId, batch._id);

    const partition = validateBatch(
      lines.map((line) => ({
        employeeId: line.employeeId,
        beneficiaryName: line.beneficiaryName,
        accountNumber: line.accountNumber,
        ifsc: line.ifsc,
        amount: toRupees(line.amountPaise),
      })),
      { debitIfsc: batch.debitIfsc },
    );

    const totals = computeControlTotals(partition.valid);

    batch.controlTotals = totals;
    batch.rejectedLines = partition.rejected;
    batch.status = partition.allValid
      ? BATCH_STATUS.VALIDATED
      : BATCH_STATUS.DRAFT;
    batch.validatedAt = new Date();
    await batch.save();

    return res.json({
      message: partition.allValid
        ? 'Batch validated'
        : 'Batch has lines that cannot be sent',
      status: batch.status,
      accepted: partition.valid.length,
      rejected: partition.rejected,
      controlTotals: { ...totals, totalAmount: totals.totalAmount },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/disbursements/batches/:id/file?format=nach|delimited&profile=hdfc
 *
 * The one endpoint that emits full account numbers, and it emits them as a file
 * download rather than as JSON.
 */
exports.getBatchFile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await DisbursementBatch.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    if (batch.status === BATCH_STATUS.DRAFT) {
      return res.status(409).json({
        message:
          'Batch has not been validated. Validate it before generating a file.',
      });
    }

    const lines = await loadLinesForFile(req.tenantId, batch._id);
    const format = String(req.query.format || 'nach').toLowerCase();

    const generated =
      format === 'delimited'
        ? generateDelimitedFile(batch, lines, req.query.profile || 'hdfc')
        : generateNachFile(batch, lines);

    if (!generated.ok) {
      return res.status(400).json({ message: generated.error });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DISBURSEMENT_FILE_GENERATED',
      resourceType: 'DisbursementBatch',
      resourceIds: [batch._id],
      details: {
        format,
        profile: req.query.profile || null,
        records: lines.length,
      },
      req,
    });

    const extension = format === 'delimited' ? 'csv' : 'txt';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${batch.batchReference}.${extension}"`,
    );
    return res.send(generated.content);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/disbursements/batches/:id/release
 *
 * Idempotent: releasing an already-released batch answers 200 with the original
 * release timestamp rather than releasing again. This is a maker–checker
 * endpoint on a retryable network, and "the request timed out, click again" must
 * not be a way to pay everybody twice.
 */
exports.releaseBatch = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await DisbursementBatch.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    if (
      batch.status === BATCH_STATUS.RELEASED ||
      batch.status === BATCH_STATUS.RECONCILED
    ) {
      return res.json({
        message: 'Batch was already released',
        alreadyReleased: true,
        releasedAt: batch.releasedAt,
        status: batch.status,
      });
    }

    if (batch.status !== BATCH_STATUS.VALIDATED) {
      return res
        .status(409)
        .json({ message: 'Batch must be validated before it can be released' });
    }

    if (Array.isArray(batch.rejectedLines) && batch.rejectedLines.length > 0) {
      return res.status(409).json({
        message: `Batch has ${batch.rejectedLines.length} line(s) that cannot be sent`,
        rejected: batch.rejectedLines,
      });
    }

    const lines = await loadLinesForFile(req.tenantId, batch._id);

    // The contents may have moved since validation — a line deleted, an amount
    // corrected. Releasing against stale totals would send the bank a file whose
    // trailer disagrees with its body.
    const verification = verifyControlTotals(lines, batch.controlTotals);
    if (!verification.matches) {
      logger.warn('Disbursement batch changed after validation', {
        batchId: String(batch._id),
        differences: verification.differences,
      });
      return res.status(409).json({
        message:
          'Batch contents have changed since validation. Revalidate before releasing.',
        differences: verification.differences,
      });
    }

    batch.status = BATCH_STATUS.RELEASED;
    batch.releasedAt = new Date();
    batch.releasedBy = req.userId;
    await batch.save();

    await DisbursementLine.updateMany(
      { tenantId: req.tenantId, batchId: batch._id },
      { $set: { status: LINE_STATUS.RELEASED } },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DISBURSEMENT_BATCH_RELEASED',
      resourceType: 'DisbursementBatch',
      resourceIds: [batch._id],
      details: {
        records: batch.controlTotals.recordCount,
        totalAmount: toRupees(batch.controlTotals.totalAmountPaise),
      },
      req,
    });

    return res.json({
      message: 'Batch released',
      alreadyReleased: false,
      batch,
      totalAmount: toRupees(batch.controlTotals.totalAmountPaise),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/disbursements/batches/:id/returns
 *
 * Ingests the bank's return file and marks the bounced credits.
 */
exports.recordReturns = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const { content } = req.body;
    if (typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({
        message: 'content is required and must be the return file text',
      });
    }

    const batch = await DisbursementBatch.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    if (
      batch.status !== BATCH_STATUS.RELEASED &&
      batch.status !== BATCH_STATUS.RECONCILED
    ) {
      return res.status(409).json({
        message: 'Returns can only be recorded against a released batch',
      });
    }

    const parsed = parseReturnFile(content);
    const lines = await loadLinesForFile(req.tenantId, batch._id);
    const outcome = reconcileReturns(lines, parsed.records);

    // A return file naming credits this batch never contained almost always
    // means the wrong file was uploaded. Applying the part that happened to
    // match would mark the rest of the batch as credited on the strength of
    // somebody else's failures.
    if (outcome.unmatchedReturns.length > 0 && outcome.returnedCount === 0) {
      return res.status(409).json({
        message:
          'No return record matched this batch — is this the right file?',
        unmatched: outcome.unmatchedReturns,
        malformed: parsed.malformed,
      });
    }

    const returnedAt = new Date();
    await Promise.all(
      outcome.lines.map((line) =>
        DisbursementLine.updateOne(
          { _id: line._id, tenantId: req.tenantId },
          {
            $set: {
              status: line.status,
              returnReasonCode: line.returnReasonCode,
              returnReasonText: line.returnReasonText,
              retryable: Boolean(line.retryable),
              returnedAt:
                line.status === LINE_STATUS.RETURNED ? returnedAt : null,
            },
          },
        ),
      ),
    );

    batch.status = outcome.fullyCredited
      ? BATCH_STATUS.RECONCILED
      : BATCH_STATUS.FAILED;
    batch.reconciledAt = returnedAt;
    await batch.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'DISBURSEMENT_RETURNS_RECORDED',
      resourceType: 'DisbursementBatch',
      resourceIds: [batch._id],
      details: {
        returned: outcome.returnedCount,
        returnedAmount: outcome.returnedAmount,
        unmatched: outcome.unmatchedReturns.length,
      },
      req,
    });

    return res.json({
      message: outcome.fullyCredited
        ? 'All credits confirmed'
        : `${outcome.returnedCount} credit(s) returned`,
      status: batch.status,
      creditedCount: outcome.creditedCount,
      returnedCount: outcome.returnedCount,
      returnedAmount: outcome.returnedAmount,
      reissuableAmount: outcome.reissuableAmount,
      needsNewBankDetails: outcome.needsNewBankDetails,
      unmatched: outcome.unmatchedReturns,
      malformed: parsed.malformed,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/disbursements/profiles
 *
 * The bank layouts this server can emit. A UI that hard-codes the list drifts
 * the moment a profile is added.
 */
exports.getBankProfiles = async (req, res) => {
  return res.json({
    profiles: Object.entries(BANK_PROFILES).map(([key, profile]) => ({
      key,
      label: profile.label,
      delimiter: profile.delimiter,
      columns: profile.columns.map((column) => column.header),
    })),
  });
};

exports._internals = { loadLinesForFile };
