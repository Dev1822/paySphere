/**
 * @fileoverview Expense Claims Controller
 * @description Handles policy configuration, OCR receipt uploads, claim workflows,
 * approval workflows, status transitions, and expense category management.
 *
 * Issues: #719, #794, #1082
 */

const mongoose = require('mongoose');
const ExpenseClaim = require('../models/expenseClaim.model');
const ExpenseCategory = require('../models/expenseCategory.model');
const { ExpensePolicy } = require('../models/expensePolicy.model');
const ExpenseReport = require('../models/expenseReport.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const OCRService = require('../services/ocr.service');
const {
  extractReceiptData,
  isConfidenceReliable,
} = require('../services/ocr.service');
const { evaluateClaim } = require('../utils/policyEngine.utils');
const { ACCOUNT_TYPE } = require('../config/accountTypes');
const { sanitizeText } = require('../utils/validators');
const {
  createObjectKey,
  deleteObject,
  getDownloadUrl,
  putObject,
  isStorageUri,
} = require('../services/objectStorage.service');

/** Claims that may still be edited or acted on. */
const PENDING = 'pending_approval';

/**
 * Which employee record, if any, this caller is allowed to file against.
 *
 * An EMPLOYEE account is a self-service login bound to one Employee record, so
 * it may file its own receipts and nobody else's. An ADMIN account is HR and may
 * file on anyone's behalf in its own tenant.
 *
 * Without this, holding WRITE_EXPENSE would be enough to submit a claim against
 * a colleague — the controller took `employeeId` straight from the body and
 * only checked that it belonged to the same tenant (#794).
 *
 * @param {object} req
 * @returns {string|null} the employee id the caller is pinned to, or null for "any"
 */
function pinnedEmployeeId(req) {
  if (req.accountType !== ACCOUNT_TYPE.EMPLOYEE) return null;
  return req.user?.employeeId ? String(req.user.employeeId) : null;
}

// ============================================================================
// POLICY MANAGEMENT (#1082)
// ============================================================================

/**
 * GET /api/expenses/policy
 * Retrieve current expense policy for the tenant. Initializes defaults if missing.
 */
exports.getPolicy = async (req, res, next) => {
  try {
    let policy = await ExpensePolicy.findOne({ tenantId: req.tenantId });
    if (!policy) {
      // Initialize default policy if none exists
      policy = await ExpensePolicy.create({
        tenantId: req.tenantId,
        categories: [
          {
            category: 'Meals',
            maxLimitPerClaim: 1500,
            maxLimitPerMonth: 5000,
            requiresReceipt: true,
            receiptThreshold: 200,
            weekendAllowed: false,
          },
          {
            category: 'Travel',
            maxLimitPerClaim: 10000,
            maxLimitPerMonth: 30000,
            requiresReceipt: true,
            receiptThreshold: 0,
            weekendAllowed: true,
          },
          {
            category: 'Office Supplies',
            maxLimitPerClaim: 5000,
            maxLimitPerMonth: 10000,
            requiresReceipt: true,
            receiptThreshold: 500,
            weekendAllowed: false,
          },
        ],
      });
    }
    res.status(200).json({ policy });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT/PATCH /api/expenses/policy
 * Update expense policy configuration.
 */
exports.updatePolicy = async (req, res, next) => {
  try {
    const { categories, autoApprovalThreshold, currency } = req.body;
    const policy = await ExpensePolicy.findOneAndUpdate(
      { tenantId: req.tenantId },
      { categories, autoApprovalThreshold, currency, updatedAt: new Date() },
      { upsert: true, new: true },
    );
    res.status(200).json({ message: 'Policy updated', policy });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CLAIM SUBMISSION WITH OCR & POLICY EVALUATION (#1082)
// ============================================================================

/**
 * POST /api/expenses/claim
 * Submit a new expense claim with optional OCR receipt processing and policy evaluation.
 */
exports.submitClaim = async (req, res, next) => {
  try {
    const { category, amount, expenseDate, description, receiptUrl } = req.body;

    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const policy = await ExpensePolicy.findOne({ tenantId: req.tenantId });
    if (!policy) {
      return res
        .status(400)
        .json({ message: 'Expense policy not configured by HR.' });
    }

    let merchant = '';
    let ocrConfidence = 0;
    let ocrRawText = '';
    let extractedDate = new Date(expenseDate);

    // Run OCR if receipt is provided
    if (receiptUrl) {
      const ocrResult = await extractReceiptData(receiptUrl);
      merchant = ocrResult.merchant;
      ocrConfidence = ocrResult.confidence;
      ocrRawText = ocrResult.rawText;

      // If OCR is highly confident, override manual date/amount inputs to prevent fraud
      if (isConfidenceReliable(ocrConfidence)) {
        extractedDate = ocrResult.date;
      }
    }

    const { calculateImageHash } = require('../utils/imageHasher');
    const imageHash =
      req.body.imageHash ||
      (receiptUrl ? calculateImageHash(Buffer.from(receiptUrl, 'utf8')) : '');

    const ocrMetadata = req.body.ocrMetadata || {
      extractedAmount:
        req.body.ocrAmount !== undefined
          ? Number(req.body.ocrAmount)
          : undefined,
      extractedDate: req.body.ocrDate ? new Date(req.body.ocrDate) : undefined,
      extractedCurrency: req.body.ocrCurrency || undefined,
    };

    // Find category ID
    const ExpenseCategory = require('../models/expenseCategory.model');
    const categoryDoc = await ExpenseCategory.findOne({
      tenantId: req.tenantId,
      $or: [
        { name: category },
        { _id: mongoose.Types.ObjectId.isValid(category) ? category : null },
      ],
    });
    const categoryId = categoryDoc ? categoryDoc._id : null;

    const claimData = {
      tenantId: req.tenantId,
      employeeId: employee._id,
      category,
      categoryId,
      amount: Number(amount),
      currency: policy.currency,
      expenseDate: extractedDate,
      merchant,
      description,
      receiptUrl,
      ocrConfidence,
      ocrRawText,
      imageHash,
      ocrMetadata,
      submittedBy: req.userId,
    };

    // Save initial claim
    const initialClaim = await ExpenseClaim.create(claimData);

    // Run Automated Adjudication (which updates status, fraud score, etc.)
    const {
      ExpenseAdjudicatorService,
    } = require('../services/ExpenseAdjudicatorService');
    const claim = await ExpenseAdjudicatorService.adjudicateClaim(
      initialClaim._id,
    );

    // We mock evaluation for the response since Adjudicator handles it now
    const evaluation = {
      isCompliant: claim.policyViolations.length === 0,
      violations: claim.policyViolations,
    };

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CLAIM_SUBMIT',
      resourceType: 'ExpenseClaim',
      resourceIds: [claim._id],
      details: {
        category,
        amount: claim.amount,
        status: claim.status,
        isCompliant: evaluation.isCompliant,
        isPossibleFraud: claim.isPossibleFraud,
        ocrConfidence,
      },
      req,
    });

    res.status(201).json({ message: 'Expense submitted', claim, evaluation });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/expenses/my-claims
 * Retrieve all claims for the authenticated employee.
 */
exports.getMyClaims = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const claims = await ExpenseClaim.find({
      employeeId: employee._id,
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    res.status(200).json({ claims });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expenses/claims/:id/adjudicate
 * Adjudicate an expense claim from the Adjudication Workspace.
 */
exports.adjudicateClaimStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected', 'needs_info'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const claim = await ExpenseClaim.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!claim) {
      return res.status(404).json({ message: 'Expense claim not found' });
    }

    claim.status = status;

    if (status === 'rejected' || status === 'needs_info') {
      claim.rejectionReason = rejectionReason || '';
      claim.rejectedBy = req.userId;
      claim.rejectedAt = new Date();
    } else if (status === 'approved') {
      claim.approvedBy = req.userId;
      claim.approvedAt = new Date();
    }

    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CLAIM_ADJUDICATE',
      resourceType: 'ExpenseClaim',
      resourceIds: [claim._id],
      details: {
        status,
        rejectionReason,
      },
      req,
    });

    res.status(200).json({ message: 'Expense claim adjudicated', claim });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// LEGACY EXPENSE CLAIM CRUD (Preserved from original)
// ============================================================================

/**
 * POST /api/expenses
 * Submit a new expense claim with receipts (legacy endpoint)
 */
exports.submitExpense = async (req, res, next) => {
  try {
    const { employeeId, categoryId, amount, expenseDate, description } =
      req.body;

    if (
      !mongoose.Types.ObjectId.isValid(employeeId) ||
      !mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const pinned = pinnedEmployeeId(req);
    if (pinned !== null && pinned !== String(employeeId)) {
      return res.status(403).json({
        message: 'You can only submit expense claims for yourself',
      });
    }

    // An employee login with no linked record has nothing it is allowed to file
    // against, and falling through would let it file against anyone.
    if (req.accountType === ACCOUNT_TYPE.EMPLOYEE && pinned === null) {
      return res.status(403).json({
        message: 'This account is not linked to an employee record',
      });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: 'Amount must be a number greater than zero' });
    }

    // `new Date(undefined)` is an Invalid Date, which mongoose casts to null and
    // then rejects with a validation error 40 lines later. Caught here so the
    // caller gets told which field is wrong.
    const parsedDate = new Date(expenseDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res
        .status(400)
        .json({ message: 'A valid expenseDate is required' });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: 'A description is required' });
    }

    // Verify employee belongs to tenant
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
      isDeleted: { $ne: true },
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    // Verify category belongs to tenant
    const category = await ExpenseCategory.findOne({
      _id: categoryId,
      tenantId: req.tenantId,
      isActive: true,
    });
    if (!category)
      return res
        .status(404)
        .json({ message: 'Expense category not found or inactive' });

    // Upload receipt bytes only after the claim's tenant/employee/category
    // checks have passed. Nothing is written to the application filesystem.
    const uploadedReceiptUris = [];
    let receipts = [];
    try {
      receipts = await Promise.all(
        (req.files || []).map(async (file) => {
          const extension = file.mimetype === 'application/pdf'
            ? 'pdf'
            : file.mimetype.split('/')[1];
          const key = createObjectKey({
            tenantId: req.tenantId,
            area: 'expenses/receipts',
            extension,
          });
          const stored = await putObject({
            key,
            body: file.buffer,
            contentType: file.mimetype,
          });
          uploadedReceiptUris.push(stored.uri);
          return {
            url: stored.uri,
            filename: sanitizeText(String(file.originalname).slice(0, 255)),
            mimetype: file.mimetype,
            size: file.size,
          };
        }),
      );

        const claim = await ExpenseClaim.create({
        tenantId: req.tenantId,
        employeeId,
        categoryId,
        amount: parsedAmount,
        currency: employee.currency || 'INR',
        expenseDate: parsedDate,
        description: sanitizeText(String(description).slice(0, 1000)),
        receipts,
        status: PENDING,
        submittedBy: req.userId,
      });

      eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_SUBMIT',
      resourceType: 'ExpenseClaim',
      resourceIds: [claim._id],
      details: { employeeId, amount: parsedAmount, category: category.name },
      req,
    });

      res
        .status(201)
        .json({
          message: 'Expense claim submitted successfully',
          claim: await hydrateReceiptUrls(typeof claim.toObject === 'function' ? claim.toObject() : claim),
        });
    } catch (error) {
      await Promise.all(uploadedReceiptUris.map((uri) => deleteObject(uri).catch(() => false)));
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

async function hydrateReceiptUrls(claim) {
  if (!claim?.receipts?.length) return claim;
  return {
    ...claim,
    receipts: await Promise.all(
      claim.receipts.map(async (receipt) => ({
        ...receipt,
        url: isStorageUri(receipt.url)
          ? await getDownloadUrl(receipt.url)
          : receipt.url,
      })),
    ),
  };
}

/**
 * GET /api/expenses
 * List expense claims (filtered by status, employee, etc.)
 */
exports.getExpenses = async (req, res, next) => {
  try {
    const { status, employeeId, page = 1, limit = 20 } = req.query;
    const query = { tenantId: req.tenantId };

    if (status) query.status = status;

    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ message: 'Invalid employeeId' });
      }
      query.employeeId = employeeId;
    }

    // An employee login sees its own claims, whatever it asked for. Previously
    // the filter was taken at face value, so anyone with READ_EXPENSE could
    // page through every colleague's receipts — amounts, dates and descriptions
    // included (#794).
    const pinned = pinnedEmployeeId(req);
    if (pinned !== null) query.employeeId = pinned;
    else if (req.accountType === ACCOUNT_TYPE.EMPLOYEE) {
      return res.status(403).json({
        message: 'This account is not linked to an employee record',
      });
    }

    // An unbounded `limit` from the query string is a way to ask the server to
    // load the whole collection into memory. A nonsensical one — negative, zero,
    // not a number — falls back to the default rather than being clamped to 1,
    // which would silently paginate a list one row at a time.
    const positiveOr = (value, fallback, ceiling = Infinity) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) return fallback;
      return Math.min(parsed, ceiling);
    };

    const parsedPage = positiveOr(page, 1);
    const parsedLimit = positiveOr(limit, 20, 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const [claims, total] = await Promise.all([
      ExpenseClaim.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('categoryId', 'name isTaxable')
        .populate('employeeId', 'fullName department')
        .lean(),
      ExpenseClaim.countDocuments(query),
    ]);

    const hydratedClaims = await Promise.all(claims.map((claim) => hydrateReceiptUrls(claim)));

    res.status(200).json({
      claims: hydratedClaims,
      pagination: {
        total,
        page: parsedPage,
        pageSize: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/expenses/:id/status
 * Approve or reject an expense claim
 */
exports.updateExpenseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid claim ID format' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Status must be approved or rejected' });
    }

    const claim = await ExpenseClaim.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!claim)
      return res.status(404).json({ message: 'Expense claim not found' });

    if (claim.status !== PENDING) {
      return res
        .status(409)
        .json({ message: 'Claim has already been processed' });
    }

    // Maker-checker, the same separation #458 established for payroll: the
    // account that filed a claim cannot be the one that signs it off. Holding
    // both WRITE_EXPENSE and APPROVE_EXPENSE is normal for an owner working
    // alone, so the check is on the individual claim rather than on the role.
    if (String(claim.submittedBy) === String(req.userId)) {
      return res.status(403).json({
        message:
          'An expense claim must be approved by someone other than the person who submitted it',
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    claim.status = status;

    if (status === 'approved') {
      claim.approvedBy = req.userId;
      claim.approvedAt = new Date();
    } else {
      // Recorded on the fields that mean "rejected", not on the ones that mean
      // "approved". The original wrote approvedBy/approvedAt for both, so a
      // rejected claim carried an approver.
      claim.rejectedBy = req.userId;
      claim.rejectedAt = new Date();
      claim.rejectionReason = sanitizeText(
        String(rejectionReason).slice(0, 500),
      );
    }

    await claim.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: status === 'approved' ? 'EXPENSE_APPROVE' : 'EXPENSE_REJECT',
      resourceType: 'ExpenseClaim',
      resourceIds: [claim._id],
      details: { amount: claim.amount, status },
      req,
    });

    res.status(200).json({ message: `Expense claim ${status}`, claim });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CATEGORY MANAGEMENT (Preserved from original)
// ============================================================================

/**
 * GET /api/expenses/categories
 */
exports.getCategories = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const query = { tenantId: req.tenantId };

    if (!includeInactive) query.isActive = true;

    const categories = await ExpenseCategory.find(query)
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/expenses/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, isTaxable } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'A category name is required' });
    }

    const category = await ExpenseCategory.create({
      tenantId: req.tenantId,
      name: sanitizeText(String(name).trim().slice(0, 100)),
      description: description
        ? sanitizeText(String(description).slice(0, 500))
        : '',
      // Defaults to tax-free, matching the model: most reimbursements are the
      // employee being made whole rather than being paid.
      isTaxable: isTaxable === true || isTaxable === 'true',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CATEGORY_CREATE',
      resourceType: 'ExpenseCategory',
      resourceIds: [category._id],
      details: { name: category.name, isTaxable: category.isTaxable },
      req,
    });

    res.status(201).json({ message: 'Expense category created', category });
  } catch (error) {
    // The model declares { tenantId, name } unique, which is the check for
    // "this category already exists" — reported as a conflict rather than as an
    // unhandled driver error.
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A category with that name already exists' });
    }
    next(error);
  }
};

/**
 * PATCH /api/expenses/categories/:id
 *
 * Deactivation rather than deletion. A category is referenced by every claim
 * ever filed under it, and removing the row is what makes `populate` return
 * null in the payroll run.
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isTaxable, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    const category = await ExpenseCategory.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!category)
      return res.status(404).json({ message: 'Expense category not found' });

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'A category name is required' });
      }
      category.name = sanitizeText(String(name).trim().slice(0, 100));
    }

    if (description !== undefined) {
      category.description = sanitizeText(String(description).slice(0, 500));
    }

    if (isActive !== undefined) {
      category.isActive = isActive === true || isActive === 'true';
    }

    if (isTaxable !== undefined) {
      const next = isTaxable === true || isTaxable === 'true';

      // Flipping `isTaxable` changes how already-approved claims will be paid:
      // taxable ones go in as earnings before tax, tax-free ones are added to
      // net pay afterwards. Changing it under claims that are already waiting on
      // a payroll run would silently re-price them, so it is refused while any
      // are outstanding.
      if (next !== category.isTaxable) {
        const waiting = await ExpenseClaim.countDocuments({
          tenantId: req.tenantId,
          categoryId: category._id,
          status: { $in: [PENDING, 'approved'] },
          payrollId: null,
        });

        if (waiting > 0) {
          return res.status(409).json({
            message: `Cannot change isTaxable while ${waiting} claim(s) in this category are awaiting reimbursement`,
          });
        }

        category.isTaxable = next;
      }
    }

    await category.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CATEGORY_UPDATE',
      resourceType: 'ExpenseCategory',
      resourceIds: [category._id],
      details: {
        name: category.name,
        isTaxable: category.isTaxable,
        isActive: category.isActive,
      },
      req,
    });

    res.status(200).json({ message: 'Expense category updated', category });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A category with that name already exists' });
    }

    logger.error('Failed to update expense category', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

// ============================================================================
// OCR RECEIPT PARSING (Updated for #1082)
// ============================================================================

/**
 * POST /api/expenses/parse-receipt
 * Parse receipt text/file using OCR parsing engine and auto-convert currency.
 */
exports.parseReceipt = async (req, res, next) => {
  try {
    const rawText =
      req.body?.rawText || (req.file ? req.file.buffer.toString('utf8') : '');
    const targetCurrency = req.body?.targetCurrency || 'USD';

    if (!rawText || rawText.trim() === '') {
      return res
        .status(400)
        .json({ message: 'No receipt text or image file provided' });
    }

    const ocrResult = await OCRService.processReceipt(rawText, targetCurrency);
    return res.status(200).json(ocrResult);
  } catch (error) {
    logger.error('Failed to parse receipt via OCR', { error: error.message });
    next(error);
  }
};

// ============================================================================
// CUSTOM EXPENSE REPORTS & REIMBURSEMENT TRACKING (#1285)
// ============================================================================

/**
 * POST /api/expenses/reports/custom
 * Create a new custom expense report bundling multiple expense claims.
 */
exports.createCustomReport = async (req, res, next) => {
  try {
    const { title, description, claimIds } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    let employeeId = pinnedEmployeeId(req);
    if (!employeeId) {
      if (req.body.employeeId) {
        employeeId = req.body.employeeId;
      } else {
        const emp = await Employee.findOne({
          userId: req.userId,
          tenantId: req.tenantId,
        });
        employeeId = emp?._id || req.userId;
      }
    }

    let claims = [];
    let totalAmount = 0;
    if (Array.isArray(claimIds) && claimIds.length > 0) {
      claims = await ExpenseClaim.find({
        _id: { $in: claimIds },
        tenantId: req.tenantId,
      });
      totalAmount = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
    }

    const report = await ExpenseReport.create({
      title: sanitizeText(title),
      description: description ? sanitizeText(description) : '',
      employeeId,
      userId: req.userId,
      tenantId: req.tenantId,
      claimIds: claims.map((c) => c._id),
      totalAmount,
      status: 'submitted',
    });

    res
      .status(201)
      .json({ message: 'Custom expense report created successfully', report });
  } catch (error) {
    logger.error('Failed to create custom expense report', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * GET /api/expenses/reports/my
 * Fetch custom expense reports for current employee with status tracking.
 */
exports.getMyReports = async (req, res, next) => {
  try {
    const reports = await ExpenseReport.find({
      tenantId: req.tenantId,
      userId: req.userId,
    })
      .populate('claimIds')
      .sort({ createdAt: -1 });

    res.status(200).json({ reports });
  } catch (error) {
    logger.error('Failed to fetch expense reports', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * GET /api/expenses/reports/export
 * Filter expense claims/reports and return summary breakdown & export data.
 */
exports.exportExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate, category, status } = req.query;
    const filter = { tenantId: req.tenantId };

    if (pinnedEmployeeId(req)) {
      filter.employeeId = pinnedEmployeeId(req);
    }

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const claims = await ExpenseClaim.find(filter).sort({ expenseDate: -1 });

    const totalAmount = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
    const categoryBreakdown = {};
    claims.forEach((c) => {
      categoryBreakdown[c.category] =
        (categoryBreakdown[c.category] || 0) + c.amount;
    });

    res.status(200).json({
      summary: {
        totalClaims: claims.length,
        totalAmount,
        categoryBreakdown,
        filter: { startDate, endDate, category, status },
      },
      claims,
    });
  } catch (error) {
    logger.error('Failed to export custom expense report', {
      error: error.message,
    });
    next(error);
  }
};

/**
 * PATCH /api/expenses/reports/:id/status
 * Update reimbursement status for a custom expense report.
 */
exports.updateReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'reimbursed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    const report = await ExpenseReport.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!report) {
      return res.status(404).json({ message: 'Expense report not found' });
    }

    report.status = status;
    if (status === 'rejected') {
      report.rejectionReason = rejectionReason || 'No reason provided';
    } else if (status === 'reimbursed') {
      report.reimbursedAt = new Date();
    }

    await report.save();

    res
      .status(200)
      .json({ message: `Expense report marked as ${status}`, report });
  } catch (error) {
    logger.error('Failed to update expense report status', {
      error: error.message,
    });
    next(error);
  }
};

exports.getFraudClaims = async (req, res, next) => {
  try {
    const claims = await ExpenseClaim.find({
      tenantId: req.tenantId,
      isPossibleFraud: true,
    }).populate('employeeId', 'fullName email department');
    res.status(200).json({ success: true, data: claims });
  } catch (error) {
    next(error);
  }
};
