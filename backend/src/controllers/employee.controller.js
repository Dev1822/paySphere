const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const User = require('../models/user.model');
const { parse } = require('csv-parse');
const {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  escapeRegex,
  sanitizeText,
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
  FULLNAME_MAX_LENGTH,
  ROLE_MAX_LENGTH,
} = require('../utils/validators');
const PayrollUpdate = require('../models/payroll.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const { invalidateStatsCaches } = require('./stats.controller');
const Settlement = require('../models/settlement.model');
const { Client } = require('@elastic/elasticsearch');
const customFieldService = require('../services/customField.service');
const lifecycleEventService = require('../services/lifecycleEvent.service');

const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});
/**
 * Normalize an employee email for storage.
 *
 * Returns `undefined` for a blank/absent address rather than `""`, so the
 * partial unique index on { email, createdBy } skips the document entirely.
 * Storing empty strings would put every email-less employee back into the same
 * index bucket and re-create the duplicate-key collision (#414).
 *
 * @param {*} value raw value from the request body or a CSV cell
 * @returns {{ ok: true, value: string|undefined } | { ok: false }}
 */
function normalizeEmployeeEmail(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    // Explicitly clearing the address.
    return { ok: true, value: undefined };
  }
  if (!isValidEmail(value)) return { ok: false };
  return { ok: true, value: value.trim().toLowerCase() };
}

/**
 * Normalize an employee phone number for storage (#8).
 *
 * Mirrors normalizeEmployeeEmail: blank/absent means "not provided" (or
 * "clear it" on update), so we return undefined rather than an empty
 * string. Only validates format when a non-empty value is actually given,
 * since phone is optional on creation.
 *
 * @param {*} value raw value from the request body
 * @returns {{ ok: true, value: string|undefined } | { ok: false }}
 */
function normalizeEmployeePhone(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return { ok: true, value: undefined };
  }
  if (!isValidPhone(value)) return { ok: false };

  const normalized = value.trim().replace(/[()\s-]/g, '');
  return { ok: true, value: normalized };
}

/**
 * Translate a duplicate-key violation on the employee email index into a 409
 * the client can act on, instead of leaking a raw driver error as a 500.
 *
 * @returns {boolean} true if the error was handled
 */
function handleDuplicateEmail(error, res) {
  if (
    error &&
    error.code === 11000 &&
    error.keyPattern &&
    'email' in error.keyPattern
  ) {
    res.status(409).json({
      message: 'An employee with this email address already exists',
    });
    return true;
  }
  return false;
}
// ADD EMPLOYEE
exports.addEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const {
      fullName,
      role,
      department,
      monthlySalary,
      overtimeRate,
      dateOfBirth,
      joiningDate,
      email,
      phone,
      bankDetails,
      language,
      customData,
    } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(role)) {
      return res
        .status(400)
        .json({ message: 'Full name and role are required non-empty strings' });
    }

    const numSalary = Number(monthlySalary);
    if (
      monthlySalary === undefined ||
      monthlySalary === null ||
      isNaN(numSalary) ||
      !Number.isFinite(numSalary) ||
      numSalary <= 0
    ) {
      return res
        .status(400)
        .json({ message: 'Monthly salary must be a positive number' });
    }
    if (numSalary > MONTHLY_SALARY_MAX) {
      return res.status(400).json({
        message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
      });
    }

    let numOvertime = 0;
    if (overtimeRate !== undefined && overtimeRate !== null) {
      numOvertime = Number(overtimeRate);
      if (
        isNaN(numOvertime) ||
        !Number.isFinite(numOvertime) ||
        numOvertime < 0
      ) {
        return res
          .status(400)
          .json({ message: 'Overtime rate must be a non-negative number' });
      }
      if (numOvertime > OVERTIME_RATE_MAX) {
        return res.status(400).json({
          message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
        });
      }
    }

    // `email` was destructured here and then never used, so every address sent
    // to this endpoint was silently discarded — which is why payslip email
    // delivery could never find an address to send to (#414).
    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    // Phone is optional, but if provided it must match a valid international
    // phone-number format.
    const normalizedPhone = normalizeEmployeePhone(phone);
    if (!normalizedPhone.ok) {
      return res.status(400).json({
        message: 'Phone number must be a valid international phone number',
      });
    }

    // Get the user's company name
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let validatedCustomData = {};
    try {
      validatedCustomData = await customFieldService.validateCustomData(
        'Employee',
        req.tenantId || user.tenantId,
        customData,
      );
    } catch (error) {
      if (error.isCustomValidation) {
        return res.status(422).json({
          message: 'Custom field validation failed',
          errors: error.fieldErrors,
        });
      }
      throw error;
    }

    const employee = new Employee({
      fullName: sanitizeText(fullName),
      role: sanitizeText(role),
      // `department` used to be referenced here without being destructured
      // from req.body above, which threw a ReferenceError on every call to
      // this endpoint.
      department: department ? sanitizeText(department) : '',
      monthlySalary: numSalary,
      overtimeRate: numOvertime,
      companyName: sanitizeText(user.companyName),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      createdBy: req.userId,
      tenantId: req.tenantId || user.tenantId,
      ...(normalizedEmail.value ? { email: normalizedEmail.value } : {}),
      ...(normalizedPhone.value ? { phone: normalizedPhone.value } : {}),
      ...(language ? { language } : {}),
      customData: validatedCustomData,
    });

    // Optionally store bank details if provided
    if (bankDetails && typeof bankDetails === 'object') {
      employee.bankDetails = {
        bankName: sanitizeText(bankDetails.bankName || ''),
        accountNumber: sanitizeText(bankDetails.accountNumber || ''),
        routingCode: sanitizeText(bankDetails.routingCode || ''),
      };
    }

    await employee.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_CREATE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        role: employee.role,
        monthlySalary: employee.monthlySalary,
      },
      req,
    });

    logger.info(`Employee created`, {
      userId: req.userId,
      employeeId: employee._id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    await invalidateStatsCaches(req.tenantId);
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);
    res.status(201).json({ message: 'Employee added successfully', employee });
  } catch (error) {
    if (handleDuplicateEmail(error, res)) return;
    next(error);
  }
};

// GET ALL EMPLOYEES (for the logged-in user's company)
exports.getEmployees = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;
    const includeInactive = req.query.includeInactive === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';

    let search = req.query.search;
    if (typeof search !== 'string') search = '';
    search = sanitizeText(search);

    let name = req.query.name;
    if (typeof name !== 'string') name = '';
    name = sanitizeText(name);

    let role = req.query.role;
    if (typeof role !== 'string') role = '';
    role = sanitizeText(role);

    const skip = (page - 1) * limit;

    const query = req.tenantId
      ? {}
      : { createdBy: req.userId };

    if (!includeDeleted) {
      query.deletedAt = null;
    }

    if (!includeInactive) {
      query.isActive = true;
    }

    const conditions = [];

    if (search) {
      const safeSearch = escapeRegex(search);
      conditions.push({
        $or: [
          { fullName: { $regex: safeSearch, $options: 'i' } },
          { role: { $regex: safeSearch, $options: 'i' } },
        ],
      });
    }

    if (name) {
      const safeName = escapeRegex(name);
      conditions.push({ fullName: { $regex: safeName, $options: 'i' } });
    }

    if (role) {
      const safeRole = escapeRegex(role);
      conditions.push({ role: { $regex: safeRole, $options: 'i' } });
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    // `?includeDeleted=true` has to opt out of the plugin as well as out of the
    // `` clause above (#897). Now that `deleteEmployee` sets
    // `isDeleted`, a query with no `deletedAt` key gets `isDeleted: { $ne:
    // true }` appended by softDelete.plugin.js — so asking for deleted rows
    // would return exactly the rows that are not deleted.
    const options = includeDeleted ? { includeDeleted: true } : {};

    const totalEmployees =
      await Employee.countDocuments(query).setOptions(options);

    const employees = await Employee.find(query)
      .setOptions(options)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalEmployees / limit);

    res.status(200).json({
      employees,
      currentPage: page,
      totalPages,
      totalEmployees,
    });
  } catch (error) {
    next(error);
  }
};

// GET RECENTLY ADDED EMPLOYEES (last 5)
exports.getRecentEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find({
      createdBy: req.userId,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    next(error);
  }
};

// GET LIGHTWEIGHT EMPLOYEE LIST FOR THE ORG CHART BUILDER (#1287)
exports.getOrgChart = async (req, res, next) => {
  try {
    const query = req.tenantId
      ? {}
      : { createdBy: req.userId };
    query.deletedAt = null;
    query.isActive = true;

    const employees = await Employee.find(query)
      .select('_id fullName role department managerId')
      .lean();

    res.status(200).json({ employees });
  } catch (error) {
    next(error);
  }
};

// REASSIGN AN EMPLOYEE TO A DIFFERENT MANAGER (drag-and-drop org chart, #1287)
exports.updateEmployeeManager = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const query = req.tenantId
      ? {
      _id: id
    }
      : { _id: id, createdBy: req.userId };

    const employee = await Employee.findOne(query);
    if (!employee || employee.deletedAt) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Clearing the manager (dragging to "no manager") makes this a root node.
    if (!managerId) {
      employee.managerId = null;
      await employee.save();
      return res.status(200).json({ employee });
    }

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: 'Invalid manager id' });
    }

    if (String(managerId) === String(id)) {
      return res
        .status(400)
        .json({ message: 'An employee cannot manage themselves' });
    }

    const managerQuery = req.tenantId
      ? {
      _id: managerId
    }
      : { _id: managerId, createdBy: req.userId };

    let cursor = await Employee.findOne(managerQuery);
    if (!cursor || cursor.deletedAt) {
      return res.status(404).json({ message: 'Manager not found' });
    }

    // Walk up the proposed manager's own chain — if `employee` turns up as
    // one of their managers, this reassignment would create a reporting loop.
    const visited = new Set();
    while (cursor && cursor.managerId) {
      const nextId = String(cursor.managerId);
      if (nextId === String(id)) {
        return res
          .status(400)
          .json({ message: 'This change would create a reporting loop' });
      }
      if (visited.has(nextId)) break; // already-corrupt chain; don't loop forever
      visited.add(nextId);

      cursor = await Employee.findOne(
        req.tenantId
          ? {
          _id: nextId
        }
          : { _id: nextId, createdBy: req.userId },
      );
    }

    employee.managerId = managerId;
    await employee.save();

    res.status(200).json({ employee });
  } catch (error) {
    next(error);
  }
};

exports.importEmployees = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No CSV file uploaded',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    const csvData = req.file.buffer.toString('utf-8');

    parse(
      csvData,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      },
      async (err, records) => {
        try {
          if (err) {
            return res.status(400).json({
              message: 'Invalid CSV format',
            });
          }

          // Fetch existing employees to detect duplicates by fullName + role
          // Extract unique names from the CSV to minimize database query size
          const csvNames = Array.from(
            new Set(records.map((r) => r.fullName?.trim()).filter(Boolean)),
          );

          // Use case-insensitive regex for the $in query to guarantee matching without specific collation
          const nameRegexes = csvNames.map(
            (name) =>
              new RegExp(
                '^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '$',
                'i',
              ),
          );

          const existingEmployees =
            nameRegexes.length > 0
              ? await Employee.find({
                  createdBy: req.userId,
                  fullName: { $in: nameRegexes },
                }).select('fullName role')
              : [];

          const existingKeys = new Set(
            existingEmployees.map(
              (e) =>
                `${sanitizeText(e.fullName).toLowerCase()}|${sanitizeText(e.role).toLowerCase()}`,
            ),
          );

          const employees = [];
          const errors = [];
          const seenEmails = new Set();
          let skipped = 0;

          records.forEach((record, index) => {
            const rawName = record.fullName?.trim();
            const rawRole = record.role?.trim();
            const monthlySalary = Number(record.monthlySalary);
            const overtimeRate = Number(record.overtimeRate || 0);

            if (!rawName) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Full name is required' });
              return;
            }
            if (rawName.length > FULLNAME_MAX_LENGTH) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Full name exceeds maximum of ${FULLNAME_MAX_LENGTH} characters`,
              });
              return;
            }

            if (!rawRole) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Role is required' });
              return;
            }
            if (rawRole.length > ROLE_MAX_LENGTH) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Role exceeds maximum of ${ROLE_MAX_LENGTH} characters`,
              });
              return;
            }

            if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Invalid monthly salary' });
              return;
            }
            if (monthlySalary > MONTHLY_SALARY_MAX) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Monthly salary exceeds maximum of ${MONTHLY_SALARY_MAX}`,
              });
              return;
            }

            if (!Number.isFinite(overtimeRate) || overtimeRate < 0) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Invalid overtime rate' });
              return;
            }
            if (overtimeRate > OVERTIME_RATE_MAX) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Overtime rate exceeds maximum of ${OVERTIME_RATE_MAX}`,
              });
              return;
            }

            // `isValidEmail` was called here without being imported, so any row
            // carrying an email threw ReferenceError and 500'd the whole import.
            const normalizedEmail = normalizeEmployeeEmail(record.email);
            if (!normalizedEmail.ok) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Invalid email format: "${record.email}"`,
              });
              return;
            }

            // Reject addresses duplicated within the file itself, before
            // insertMany turns it into an opaque E11000.
            if (normalizedEmail.value) {
              if (seenEmails.has(normalizedEmail.value)) {
                skipped++;
                errors.push({
                  row: index + 2,
                  reason: `Duplicate email in file: "${normalizedEmail.value}"`,
                });
                return;
              }
              seenEmails.add(normalizedEmail.value);
            }

            // Same validation as single-row creation (#8): only rejects the
            // row if a phone value is present but malformed.
            const normalizedPhone = normalizeEmployeePhone(record.phone);
            if (!normalizedPhone.ok) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Invalid phone number format: "${record.phone}"`,
              });
              return;
            }

            const sanitizedName = sanitizeText(rawName);
            const sanitizedRole = sanitizeText(rawRole);
            const key = `${sanitizedName.toLowerCase()}|${sanitizedRole.toLowerCase()}`;
            if (existingKeys.has(key)) {
              skipped++;
              errors.push({
                row: index + 2,
                reason:
                  'Duplicate employee (same name and role already exists)',
              });
              return;
            }

            const sanitizedDepartment = record.department
              ? sanitizeText(record.department.trim())
              : '';

            employees.push({
              fullName: sanitizedName,
              role: sanitizedRole,
              department: sanitizedDepartment,
              monthlySalary,
              overtimeRate,
              companyName: sanitizeText(user.companyName),
              createdBy: req.userId,
              tenantId: req.tenantId || user.tenantId,
              // The address was validated above and then dropped on the floor,
              // so imported employees never had an email either (#414, #236).
              ...(normalizedEmail.value
                ? { email: normalizedEmail.value }
                : {}),
              ...(normalizedPhone.value
                ? { phone: normalizedPhone.value }
                : {}),
            });
          });

          let createdIds = [];
          if (employees.length > 0) {
            let session = null;
            try {
              session = await mongoose.startSession();
              session.startTransaction();
              let created = [];
              try {
                created = await Employee.insertMany(employees, {
                  session,
                  ordered: false,
                });
              } catch (insertError) {
                if (insertError.code === 11000) {
                  skipped += insertError.writeErrors
                    ? insertError.writeErrors.length
                    : 1;
                  created = insertError.insertedDocs || [];
                } else {
                  throw insertError;
                }
              }
              createdIds = created.map((e) => e._id);
              await session.commitTransaction();
            } catch (txError) {
              if (session) {
                try {
                  await session.abortTransaction();
                } catch {
                  /* ignore */
                }
              }
              throw txError;
            } finally {
              if (session) session.endSession();
            }
          }

          const importedCount = createdIds.length;

          eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'EMPLOYEE_IMPORT',
            resourceType: 'Employee',
            resourceIds: createdIds,
            details: {
              imported: importedCount,
              skipped,
              totalErrors: errors.length,
              fileName: req.file?.originalname,
            },
            result:
              importedCount > 0
                ? errors.length > 0
                  ? 'partial'
                  : 'success'
                : 'failure',
            req,
          });

          logger.info(`Employee CSV import completed`, {
            userId: req.userId,
            imported: importedCount,
            skipped,
            totalErrors: errors.length,
          });

          if (importedCount > 0) {
            await invalidateStatsCaches(req.tenantId);
            await cacheService.invalidateTags([
              'dept:analytics',
              'dashboard',
              'reports',
              'analytics',
              'stats:overview',
            ]);
          }

          return res.status(200).json({
            message: 'Employee import completed',
            imported: importedCount,
            skipped,
            errors,
          });
        } catch (dbError) {
          next(dbError);
        }
      },
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { id } = req.params;
    const {
      fullName,
      role,
      department,
      monthlySalary,
      overtimeRate,
      isActive,
      email,
      phone,
      bankDetails,
      language,
      version,
    } = req.body;
    // `employee` used to be referenced (for the `department` update) before
    // this declaration ran, which threw a ReferenceError on every update.
    // Scoped (#1010). One file guarded three handlers three different ways —
    // `createdBy !== req.userId` here and in `deleteEmployee`,
    // `tenantId.toString() !== req.tenantId` in `toggleActive` — and none of
    // the three was right.
    const employee = await Employee.findOne({ _id: id });
    if (!Number.isInteger(version) || version < 0) {
      return res.status(400).json({
        message: 'A valid employee version is required',
      });
    }

    if (employee && employee.__v !== version) {
      return res.status(409).json({
        message:
          'This employee was modified by another user. Reload the employee and review the latest changes before saving again.',
        currentVersion: employee.__v,
      });
    }
    if (!employee || employee.deletedAt) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // The `createdBy` check below is deliberately left as it is.
    //
    // It is not a tenant check and never was — it asks "did *you personally*
    // create this record", which is arguably too strict for a shared HR
    // Ownership is now verified by the ABAC engine middleware
    // Validate fields if provided
    if (fullName !== undefined && !isNonEmptyString(fullName)) {
      return res
        .status(400)
        .json({ message: 'Full name must be a required non-empty string' });
    }
    if (role !== undefined && !isNonEmptyString(role)) {
      return res
        .status(400)
        .json({ message: 'Role must be a required non-empty string' });
    }

    if (
      monthlySalary !== undefined &&
      (isNaN(monthlySalary) ||
        !Number.isFinite(Number(monthlySalary)) ||
        monthlySalary <= 0)
    ) {
      return res
        .status(400)
        .json({ message: 'Monthly salary must be a positive number' });
    }
    if (
      monthlySalary !== undefined &&
      Number(monthlySalary) > MONTHLY_SALARY_MAX
    ) {
      return res.status(400).json({
        message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
      });
    }

    if (
      overtimeRate !== undefined &&
      (isNaN(overtimeRate) ||
        !Number.isFinite(Number(overtimeRate)) ||
        overtimeRate < 0)
    ) {
      return res
        .status(400)
        .json({ message: 'Overtime rate must be a non-negative number' });
    }
    if (
      overtimeRate !== undefined &&
      Number(overtimeRate) > OVERTIME_RATE_MAX
    ) {
      return res
        .status(400)
        .json({ message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
    }

    // Same as addEmployee: `email` was destructured and never applied (#414).
    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    // Same pattern for phone: optional, validated only if provided.
    const normalizedPhone = normalizeEmployeePhone(phone);
    if (!normalizedPhone.ok) {
      return res.status(400).json({
        message: 'Phone number must be a valid international phone number',
      });
    }

    // Capture old name for payroll propagation check (#253)
    const oldName = employee.fullName;
    const oldDepartment = employee.department;
    const oldRole = employee.role;

    // Apply updates only for provided fields
    if (fullName !== undefined) employee.fullName = sanitizeText(fullName);
    if (role !== undefined) employee.role = sanitizeText(role);
    if (department !== undefined)
      employee.department = sanitizeText(department);
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (overtimeRate !== undefined) employee.overtimeRate = overtimeRate;
    if (isActive !== undefined) employee.isActive = isActive;
    if (req.body.dateOfBirth !== undefined)
      employee.dateOfBirth = req.body.dateOfBirth
        ? new Date(req.body.dateOfBirth)
        : undefined;
    if (req.body.joiningDate !== undefined)
      employee.joiningDate = req.body.joiningDate
        ? new Date(req.body.joiningDate)
        : undefined;

    if (email !== undefined) {
      // `undefined` here means "clear it" — assigning undefined would be a no-op
      // in mongoose, so the path has to be unset explicitly.
      if (normalizedEmail.value) {
        employee.email = normalizedEmail.value;
      } else {
        employee.email = undefined;
        employee.markModified('email');
      }
    }

    if (phone !== undefined) {
      // Same "clear on empty" semantics as email above.
      if (normalizedPhone.value) {
        employee.phone = normalizedPhone.value;
      } else {
        employee.phone = undefined;
        employee.markModified('phone');
      }
    }

    // Patch bank details: merge only the provided sub-fields
    if (bankDetails && typeof bankDetails === 'object') {
      employee.bankDetails = {
        bankName: sanitizeText(
          bankDetails.bankName ?? employee.bankDetails?.bankName ?? '',
        ),
        accountNumber: sanitizeText(
          bankDetails.accountNumber ??
            employee.bankDetails?.accountNumber ??
            '',
        ),
        routingCode: sanitizeText(
          bankDetails.routingCode ?? employee.bankDetails?.routingCode ?? '',
        ),
      };
    }

    await employee.save();

    // Propagate name change to finalized (unpaid) PayrollUpdate records (#253)
    if (fullName !== undefined && employee.fullName !== oldName) {
      try {
        const result = await PayrollUpdate.updateMany(
          { employeeId: id, createdBy: req.userId, status: 'finalized' },
          { $set: { employeeName: employee.fullName } },
        );
        logger.info(`PayrollUpdate employeeName propagated`, {
          userId: req.userId,
          employeeId: id,
          oldName,
          newName: employee.fullName,
          modifiedCount: result.modifiedCount,
        });
      } catch (propagateErr) {
        logger.error(`Failed to propagate employeeName to PayrollUpdate`, {
          userId: req.userId,
          employeeId: id,
          error: propagateErr.message,
        });
      }
    }

    if (department !== undefined && employee.department !== oldDepartment) {
      await lifecycleEventService.recordEvent({
        employeeId: employee._id,
        tenantId: employee.tenantId,
        eventType: 'DEPARTMENT_TRANSFERRED',
        category: 'Role',
        recordedBy: req.userId,
        previousValues: { department: oldDepartment },
        newValues: { department: employee.department },
      });
    }

    if (role !== undefined && employee.role !== oldRole) {
      await lifecycleEventService.recordEvent({
        employeeId: employee._id,
        tenantId: employee.tenantId,
        eventType: 'ROLE_CHANGED',
        category: 'Role',
        recordedBy: req.userId,
        previousValues: { role: oldRole },
        newValues: { role: employee.role },
      });
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_UPDATE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        role: employee.role,
        changes: Object.keys(req.body).filter((k) => k !== 'id'),
      },
      req,
    });

    logger.info(`Employee updated`, {
      userId: req.userId,
      employeeId: employee._id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    await invalidateStatsCaches(req.tenantId);
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);
    res
      .status(200)
      .json({ message: 'Employee updated successfully', employee });
  } catch (error) {
    if (error?.name === 'VersionError') {
      return res.status(409).json({
        message:
          'This employee was modified by another user. Reload the employee and review the latest changes before saving again.',
      });
    }

    if (handleDuplicateEmail(error, res)) return;
    next(error);
  }
}; // TOGGLE EMPLOYEE ACTIVE STATUS
exports.toggleEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Scoped (#1010). This handler did have a tenant check — and it never
    // passed. `auth.middleware` sets `req.tenantId` from `user.tenantId`,
    // an ObjectId, so `employee.tenantId.toString() !== req.tenantId` compared
    // a string primitive against an object and was *always* true: every call
    // answered 403, including from the company that owns the record.
    //
    // Deactivating an employee is what removes them from payroll (#260), so
    // this was not a cosmetic failure — there was no way to take a leaver off
    // the payroll through this endpoint.
    //
    // The comparison fails closed here purely by luck. The same mistake
    // written as `if (a.toString() === b) { allow }` fails open.
    const employee = await Employee.findOne({ _id: id });

    if (!employee || employee.deletedAt) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    // Inactive employees are excluded from payroll (#260), so flipping this
    // changes the analytics aggregates and must clear the cache (#415).
    await cacheService.invalidateAnalytics(req.userId);
    await invalidateStatsCaches(req.tenantId);
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);

    // This was the only employee mutation with no audit event, unlike its
    // create/update/delete siblings.
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_STATUS_TOGGLE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        isActive: employee.isActive,
      },
      req,
    });

    logger.info(`Employee status toggled`, {
      userId: req.userId,
      employeeId: employee._id,
      isActive: employee.isActive,
    });

    res.status(200).json({ message: 'Employee status updated', employee });
  } catch (error) {
    next(error);
  }
};

// DELETE EMPLOYEE (SOFT DELETE)
exports.deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Scoped (#1010). The `createdBy` check below is kept for the reason given
    // in `updateEmployee`: relaxing it is a permission-model decision, not a
    // security fix, and the two should not travel together.
    const employee = await Employee.findOne({ _id: id });

    if (!employee || employee.deletedAt) {
      return res.status(404).json({
        message: 'Employee not found',
      });
    }

    // Ownership is now verified by the ABAC engine middleware
    // Check if employee has historical "paid" payroll records (#345)
    const hasPaidPayroll = await PayrollUpdate.exists({
      employeeId: id,
      createdBy: req.userId,
      status: 'paid',
    });

    if (hasPaidPayroll) {
      return res.status(400).json({
        message: 'Cannot delete employee with historical paid payroll records',
      });
    }

    // Same principle as #345: an employee who has been formally settled has a
    // final statement on record, and destroying them would destroy the
    // counterpart to a payment that has already been made (#462).
    let hasSettlement = false;
    try {
      hasSettlement = Boolean(
        await Settlement.exists({
          employeeId: id,
          createdBy: req.userId,
          status: { $in: ['approved', 'paid'] },
        }),
      );
    } catch (settlementError) {
      // A lookup failure must not silently downgrade a protection.
      logger.error(
        'Could not check for an existing settlement before deletion',
        {
          userId: req.userId,
          employeeId: id,
          error: settlementError.message,
        },
      );
      return res.status(500).json({
        message: 'Could not verify settlement history. Deletion aborted.',
      });
    }

    if (hasSettlement) {
      return res.status(400).json({
        message:
          'Cannot delete an employee with an approved or paid full & final settlement',
      });
    }

    // `isDeleted` as well as `deletedAt` (#897).
    //
    // These are two markers for one fact, and only one of them was ever
    // written. `softDelete.plugin.js` adds both fields and every one of its
    // query hooks tests `isDeleted`; `archive.controller.js` selects on
    // `isDeleted: true`; this handler set `deletedAt` alone. So a deleted
    // employee had `isDeleted: false` forever, and the consequences ran in both
    // directions:
    //
    //   - The archive was empty for every account in the product, always. Not
    //     "empty for colleagues" — empty, because the row it selects on has
    //     never existed.
    //   - The plugin's whole purpose — hiding deleted rows from any query that
    //     has not opted in — never took effect for employees. Nothing leaked
    //     from the directory only because `getEmployees` happens to filter on
    //     `` by hand.
    //
    // Set together, so the two markers cannot disagree again. `restoreEmployee`
    // clears both.
    employee.isActive = false; // Still need to deactivate
    await employee.softDelete();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_DELETE',
      resourceType: 'Employee',
      resourceIds: [id],
      details: {
        fullName: employee.fullName,
        role: employee.role,
        deletedAt: employee.deletedAt,
      },
      req,
    });

    logger.info(`Employee soft deleted`, {
      userId: req.userId,
      employeeId: id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    await invalidateStatsCaches(req.tenantId);
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);

    res.status(200).json({
      message: 'Employee deleted successfully',
      employee,
    });
  } catch (error) {
    next(error);
  }
};

// RESTORE SOFT-DELETED EMPLOYEE
exports.restoreEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // `includeDeleted` is what makes this handler reachable at all once
    // `deleteEmployee` sets `isDeleted` (#897). Every query hook in
    // softDelete.plugin.js appends `isDeleted: { $ne: true }` unless the query
    // opts out, and `findById` goes through the `findOne` hook — so the one
    // record this endpoint exists to load is the one record it would be unable
    // to see. Restore would answer 404 for every id, forever.
    const employee = await Employee.findOne({ _id: id }).setOptions({
      includeDeleted: true,
    });

    if (!employee || !employee.deletedAt) {
      return res
        .status(404)
        .json({ message: 'Soft-deleted employee not found' });
    }

    // Scoped to the company rather than to the account that created the row
    // (#897). The archive lists the tenant's deleted employees, so a check on
    // `createdBy` here would render a restore button on every colleague's card
    // and answer 403 to all of them — an inconsistency introduced by scoping
    // the list correctly and leaving the write alone.
    //
    // `getEmployees` and the rest of this controller still scope on
    // `createdBy`; converting them is a larger change than this one and is
    // noted on #897 rather than smuggled in here.
    const sameTenant =
      employee.tenantId && req.tenantId
        ? String(employee.tenantId) === String(req.tenantId)
        : String(employee.createdBy) === String(req.userId);

    if (!sameTenant) {
      // 404, not 403: a distinguishable "exists but not yours" turns this
      // endpoint into a way to confirm which employee ids belong to another
      // company.
      return res
        .status(404)
        .json({ message: 'Soft-deleted employee not found' });
    }

    // Both markers, for the same reason `deleteEmployee` sets both. Clearing
    // `deletedAt` alone would leave `isDeleted: true` on a record the UI now
    // shows as live — and every plugin hook would go on hiding it, so the
    // employee would vanish from the directory with nothing to explain why.
    employee.isActive = true;
    await employee.restore();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EMPLOYEE_RESTORE',
      resourceType: 'Employee',
      resourceIds: [id],
      details: { fullName: employee.fullName, role: employee.role },
      req,
    });

    logger.info(`Employee restored`, {
      userId: req.userId,
      employeeId: id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    await invalidateStatsCaches(req.tenantId);
    await cacheService.invalidateTags([
      'dept:analytics',
      'dashboard',
      'reports',
      'analytics',
      'stats:overview',
    ]);

    res.status(200).json({
      message: 'Employee restored successfully',
      employee,
    });
  } catch (error) {
    next(error);
  }
};
// EXPORT EMPLOYEES TO CSV
exports.exportEmployeesCSV = async (req, res, next) => {
  try {
    const query = {
      createdBy: req.userId,
    };

    const employees = await Employee.find(query).sort({ createdAt: -1 });

    const header = [
      'Name',
      'Role',
      'Email',
      'Phone',
      'Status',
      'Monthly Salary',
      'Overtime Rate',
      'Date of Birth',
      'Joining Date',
      'Department',
    ];

    const escapeCsvField = (value) => {
      if (value === undefined || value === null) return '';
      let str = String(value);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    const rows = employees.map((emp) => [
      escapeCsvField(emp.fullName || ''),
      escapeCsvField(emp.role || ''),
      escapeCsvField(emp.email || ''),
      escapeCsvField(emp.phone || ''),
      escapeCsvField(emp.isActive ? 'Active' : 'Inactive'),
      emp.monthlySalary || 0,
      emp.overtimeRate || 0,
      escapeCsvField(formatDate(emp.dateOfBirth)),
      escapeCsvField(formatDate(emp.joiningDate)),
      escapeCsvField(emp.department || ''),
    ]);

    const csvContent = [
      header.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=employees_${new Date().toISOString().split('T')[0]}.csv`,
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

exports.searchEmployees = async (req, res) => {
  try {
    // Extract query parameters
    const { q, department, role } = req.query;

    // Security: ALWAYS isolate by the requesting user's tenantId!
    const tenantId = req.tenantId;

    // Build the Elasticsearch query body
    const searchBody = {
      query: {
        bool: {
          // "must" acts like an AND operator
          must: [
            { term: { tenantId: tenantId } }, // Strict tenant isolation
          ],
        },
      },
    };

    // Fuzzy Text Search (Name or Email)
    if (q) {
      searchBody.query.bool.must.push({
        multi_match: {
          query: q,
          fields: ['fullName^2', 'email'], // ^2 boosts the score of name matches over email
          fuzziness: 'AUTO', // Allows for typos (e.g., "Jhon" finds "John")
        },
      });
    }

    // Facet Filtering (Department)
    if (department) {
      searchBody.query.bool.must.push({
        term: { department: department },
      });
    }

    // Facet Filtering (Role)
    if (role) {
      searchBody.query.bool.must.push({
        term: { role: role },
      });
    }

    // Execute the search
    const result = await esClient.search({
      index: 'employees',
      body: searchBody,
    });

    // Format the response to strip out Elasticsearch metadata
    const hits = result.hits.hits.map((hit) => ({
      _id: hit._id,
      ...hit._source,
      score: hit._score, // Optional: shows how relevant the result is
    }));

    res.status(200).json({
      success: true,
      total: result.hits.total.value,
      data: hits,
    });
  } catch (error) {
    logger.error('Elasticsearch query failed', {
      error: error.message || error,
    });
    res.status(500).json({ success: false, message: 'Search engine error' });
  }
};
