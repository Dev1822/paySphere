const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const { parse } = require("csv-parse");
const { isNonEmptyString, escapeRegex, sanitizeText, MONTHLY_SALARY_MAX, OVERTIME_RATE_MAX } = require("../utils/validators");
const PayrollUpdate = require("../models/payroll.model");
const logger = require("../utils/logger");
const { createAuditLog } = require("../services/audit.service");
// ADD EMPLOYEE
exports.addEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Request body is required" });
    }
    const { fullName, role, monthlySalary, overtimeRate } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(role)) {
      return res.status(400).json({ message: "Full name and role are required non-empty strings" });
    }

    const numSalary = Number(monthlySalary);
    if (monthlySalary === undefined || monthlySalary === null || isNaN(numSalary) || !Number.isFinite(numSalary) || numSalary <= 0) {
      return res.status(400).json({ message: "Monthly salary must be a positive number" });
    }
    if (numSalary > MONTHLY_SALARY_MAX) {
      return res.status(400).json({ message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}` });
    }

    let numOvertime = 0;
    if (overtimeRate !== undefined && overtimeRate !== null) {
      numOvertime = Number(overtimeRate);
      if (isNaN(numOvertime) || !Number.isFinite(numOvertime) || numOvertime < 0) {
        return res.status(400).json({ message: "Overtime rate must be a non-negative number" });
      }
      if (numOvertime > OVERTIME_RATE_MAX) {
        return res.status(400).json({ message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
      }
    }

    // Get the user's company name
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const employee = new Employee({
      fullName: sanitizeText(fullName),
      role: sanitizeText(role),
      monthlySalary: numSalary,
      overtimeRate: numOvertime,
      companyName: sanitizeText(user.companyName),
      createdBy: req.userId,
    });

    await employee.save();

    createAuditLog({
      userId: req.userId,
      action: "EMPLOYEE_CREATE",
      resourceType: "Employee",
      resourceIds: [employee._id],
      details: { fullName: employee.fullName, role: employee.role, monthlySalary: employee.monthlySalary },
      req,
    });

    logger.info(`Employee created`, { userId: req.userId, employeeId: employee._id, fullName: employee.fullName });

    res.status(201).json({ message: "Employee added successfully", employee });
  } catch (error) {
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
    const includeInactive = req.query.includeInactive === "true";

    let search = req.query.search;
    if (typeof search !== "string") search = "";
    search = sanitizeText(search);

    const skip = (page - 1) * limit;

    const query = {
      createdBy: req.userId,
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { fullName: { $regex: safeSearch, $options: "i" } },
        { role: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const totalEmployees = await Employee.countDocuments(query);

    const employees = await Employee.find(query)
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
    const employees = await Employee.find({ createdBy: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    next(error);
  }
};

exports.importEmployees = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No CSV file uploaded",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const csvData = req.file.buffer.toString("utf-8");

    parse(
      csvData,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
      async (err, records) => {
        try {
          if (err) {
            return res.status(400).json({
              message: "Invalid CSV format",
            });
          }

          // Fetch existing employees to detect duplicates by fullName + role
          // Extract unique names from the CSV to minimize database query size
          const csvNames = Array.from(new Set(records.map(r => r.fullName?.trim()).filter(Boolean)));
          
          // Use case-insensitive regex for the $in query to guarantee matching without specific collation
          const nameRegexes = csvNames.map(name => new RegExp('^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '$', 'i'));

          const existingEmployees = nameRegexes.length > 0
            ? await Employee.find({ 
                createdBy: req.userId,
                fullName: { $in: nameRegexes }
              }).select('fullName role')
            : [];

          const existingKeys = new Set(
            existingEmployees.map(e => `${sanitizeText(e.fullName).toLowerCase()}|${sanitizeText(e.role).toLowerCase()}`)
          );

          const employees = [];
          const errors = [];
          let skipped = 0;

          records.forEach((record, index) => {
            const fullName = record.fullName?.trim();
            const role = record.role?.trim();
            const monthlySalary = Number(record.monthlySalary);
            const overtimeRate = Number(record.overtimeRate || 0);

            if (!fullName) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Full name is required",
              });
              return;
            }

            if (!role) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Role is required",
              });
              return;
            }

            if (isNaN(monthlySalary) || monthlySalary <= 0) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Invalid monthly salary",
              });
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

            if (isNaN(overtimeRate) || overtimeRate < 0) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Invalid overtime rate",
              });
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

            // Check for duplicate by fullName + role (case-insensitive)
            const sanitizedName = sanitizeText(fullName);
            const sanitizedRole = sanitizeText(role);
            const key = `${sanitizedName.toLowerCase()}|${sanitizedRole.toLowerCase()}`;
            if (existingKeys.has(key)) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Duplicate employee (same name and role already exists)",
              });
              return;
            }

            // Also prevent duplicates within the same CSV batch
            existingKeys.add(key);

            employees.push({
              fullName: sanitizeText(fullName),
              role: sanitizeText(role),
              monthlySalary,
              overtimeRate,
              companyName: sanitizeText(user.companyName),
              createdBy: req.userId,
            });
          });

          let createdIds = [];
          if (employees.length > 0) {
            const created = await Employee.insertMany(employees);
            createdIds = created.map(e => e._id);
          }

          createAuditLog({
            userId: req.userId,
            action: "EMPLOYEE_IMPORT",
            resourceType: "Employee",
            resourceIds: createdIds,
            details: { imported: employees.length, skipped, totalErrors: errors.length, fileName: req.file?.originalname },
            result: employees.length > 0 ? (errors.length > 0 ? "partial" : "success") : "failure",
            req,
          });

          logger.info(`Employee CSV import completed`, {
            userId: req.userId, imported: employees.length, skipped, totalErrors: errors.length,
          });

          return res.status(200).json({
            message: "Employee import completed",
            imported: employees.length,
            skipped,
            errors,
          });
        } catch (dbError) {
          next(dbError);
        }
      }
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Request body is required" });
    }
    const { id } = req.params;
    const { fullName, role, monthlySalary, overtimeRate, isActive } = req.body;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Ensure the logged-in user is the creator of this employee
    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to update this employee" });
    }

    // Validate fields if provided
    if (monthlySalary !== undefined && (isNaN(monthlySalary) || !Number.isFinite(Number(monthlySalary)) || monthlySalary <= 0)) {
      return res.status(400).json({ message: "Monthly salary must be a positive number" });
    }
    if (monthlySalary !== undefined && Number(monthlySalary) > MONTHLY_SALARY_MAX) {
      return res.status(400).json({ message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}` });
    }

    if (overtimeRate !== undefined && (isNaN(overtimeRate) || !Number.isFinite(Number(overtimeRate)) || overtimeRate < 0)) {
      return res.status(400).json({ message: "Overtime rate must be a non-negative number" });
    }
    if (overtimeRate !== undefined && Number(overtimeRate) > OVERTIME_RATE_MAX) {
      return res.status(400).json({ message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
    }

    // Apply updates only for provided fields
    if (fullName !== undefined) employee.fullName = sanitizeText(fullName);
    if (role !== undefined) employee.role = sanitizeText(role);
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (overtimeRate !== undefined) employee.overtimeRate = overtimeRate;
    if (isActive !== undefined) employee.isActive = isActive;

    await employee.save();

    createAuditLog({
      userId: req.userId,
      action: "EMPLOYEE_UPDATE",
      resourceType: "Employee",
      resourceIds: [employee._id],
      details: { fullName: employee.fullName, role: employee.role, changes: Object.keys(req.body).filter(k => k !== 'id') },
      req,
    });

    logger.info(`Employee updated`, { userId: req.userId, employeeId: employee._id, fullName: employee.fullName });

    res.status(200).json({ message: "Employee updated successfully", employee });
  } catch (error) {
    next(error);
  }
};

// TOGGLE EMPLOYEE ACTIVE STATUS
exports.toggleEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to update this employee" });
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    res.status(200).json({ message: "Employee status updated", employee });
  } catch (error) {
    next(error);
  }
};


// DELETE EMPLOYEE
exports.deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Check ownership
    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        message: "Not authorized to delete this employee",
      });
    }

    // Delete related payroll records
    await PayrollUpdate.deleteMany({
      employeeId: id,
      createdBy: req.userId,
    });

    // Delete employee
    await Employee.findByIdAndDelete(id);

    createAuditLog({
      userId: req.userId,
      action: "EMPLOYEE_DELETE",
      resourceType: "Employee",
      resourceIds: [id],
      details: { fullName: employee.fullName, role: employee.role },
      req,
    });

    logger.info(`Employee deleted`, { userId: req.userId, employeeId: id, fullName: employee.fullName });

    res.status(200).json({
      message: "Employee and payroll records deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};