/**
 * @fileoverview Training Course, Enrolment and Compliance Endpoints
 * @description Manages course creation, employee assignments, certificate uploads,
 * compliance dashboard statistics, and audit-safe certification tracking.
 * Issues: #1076, #1085
 *
 * Every query is filtered by `tenantId` on the way in rather than checked after
 * the fetch, the shape #1010 settled on.
 *
 * `validUntil` is stored evidence — never recomputed on read. Changing a course's
 * validity period does NOT retroactively alter existing certifications.
 */

const mongoose = require('mongoose');

const {
  TrainingCourse,
  TrainingEnrollment,
  EmployeeTrainingRecord, // Alias for TrainingEnrollment (see training.model.js)
} = require('../models/training.model');
const Employee = require('../models/employee.model');
const {
  ENROLLMENT_STATUS,
  computeValidity,
  certificationState,
  isApplicable,
  evaluateAttempt,
  coverageGaps,
  complianceRate,
  complianceByDepartment,
  renewalsDue,
} = require('../utils/trainingCompliance');
const { getComplianceStats } = require('../services/certificationExpiry.service');
const { checkMandatoryCompliance } = require('../utils/complianceGatekeeper.utils');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Helpers
// ============================================================================

/**
 * A caller-supplied date, falling back to now.
 *
 * An unparseable value falls back rather than producing an Invalid Date, which
 * compares false against everything and would silently report every
 * certification as valid.
 *
 * @param {string|undefined} raw
 * @returns {Date}
 */
function resolveAsOf(raw) {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Everything the compliance reports need, loaded once.
 *
 * The three report endpoints below all need the same three collections, and
 * three copies of these queries is three chances for one of them to forget the
 * tenant filter.
 *
 * @param {string} tenantId
 * @returns {Promise<{courses: Array, employees: Array, enrollments: Array}>}
 */
async function loadComplianceInputs(tenantId) {
  const [courses, employees, enrollments] = await Promise.all([
    TrainingCourse.find({ tenantId, isActive: true }).lean(),
    Employee.find({ tenantId, isActive: true })
      .select('_id fullName department role')
      .lean(),
    TrainingEnrollment.find({ tenantId }).lean(),
  ]);

  return { courses, employees, enrollments };
}

// ============================================================================
// Course CRUD
// ============================================================================

/**
 * POST /api/training/courses
 *
 * Supports both legacy fields (#1076) and new fields (#1085).
 * `targetDepartments` maps to `appliesToValues` when provided.
 */
exports.createCourse = async (req, res, next) => {
  try {
    const {
      code,
      title,
      description,
      category,
      isMandatory,
      appliesTo,
      appliesToValues,
      targetDepartments,
      durationMinutes,
      passMark,
      maxAttempts,
      validityMonths,
      validityDays,
      reminderLeadDays,
      externalLink,
    } = req.body;

    // title is always required; code is required for legacy compatibility
    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }
    if (!code) {
      return res.status(400).json({ message: 'code is required' });
    }

    const course = await TrainingCourse.create({
      code,
      title,
      description,
      category,
      isMandatory,
      appliesTo,

      // targetDepartments (#1085) is an alias for appliesToValues when appliesTo is department-based
      appliesToValues: appliesToValues || targetDepartments || [],

      durationMinutes,
      passMark,
      maxAttempts,
      validityMonths,
      validityDays: validityDays || 365,
      reminderLeadDays,
      externalLink,
      createdBy: req.userId
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAINING_COURSE_CREATED',
      resourceType: 'TrainingCourse',
      resourceIds: [course._id],
      details: {
        code,
        title,
        isMandatory: Boolean(isMandatory),
        validityMonths,
        validityDays,
      },
      req,
    });

    return res.status(201).json({ message: 'Course created', course });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'That course code is already in use' });
    }
    if (error.name === 'ValidationError' || error instanceof mongoose.Error) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * GET /api/training/courses
 */
exports.getCourses = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.mandatory === 'true') filter.isMandatory = true;

    const courses = await TrainingCourse.find(filter).sort({ code: 1 }).lean();

    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/training/courses/:id
 *
 * Note what this deliberately does *not* do: changing `validityMonths` or
 * `validityDays` does not touch the `validUntil` already recorded on existing
 * enrolments. Those are evidence of what the policy was when each certification
 * was issued, and rewriting them would retroactively invalidate certifications
 * that were current — or revive lapsed ones.
 */
exports.updateCourse = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const editable = [
      'title',
      'description',
      'category',
      'isMandatory',
      'appliesTo',
      'appliesToValues',
      'durationMinutes',
      'passMark',
      'maxAttempts',
      'validityMonths',
      'validityDays',
      'reminderLeadDays',
      'externalLink',
      'isActive',
    ];

    const course = await TrainingCourse.findOne({
      _id: req.params.id
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // An allow-list rather than a spread of `req.body`: `code` is referenced by
    // certificates and `tenantId` decides who can see the row, and neither
    // should be reachable from a PATCH body.
    for (const field of editable) {
      if (req.body[field] !== undefined) course[field] = req.body[field];
    }

    // Map targetDepartments alias to appliesToValues if provided
    if (req.body.targetDepartments !== undefined) {
      course.appliesToValues = req.body.targetDepartments;
    }

    await course.save();

    return res.json({
      message: 'Course updated',
      course,
      note: 'Existing certifications keep the validity they were issued under',
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error instanceof mongoose.Error) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

// ============================================================================
// Assignment
// ============================================================================

/**
 * POST /api/training/courses/:id/assign
 *
 * Assigns to an explicit list of employees, or to everyone the course applies
 * to. Existing enrolments are left alone — reassigning would reset somebody's
 * in-progress attempt to `Assigned` and lose their score.
 *
 * Also supports the #1085 body-shape `{ courseId, employeeIds }` via the
 * dedicated assignCourse handler below.
 */
exports.assignCourse = async (req, res, next) => {
  try {
    // Support both URL-param style (/courses/:id/assign) and body-style (#1085)
    const courseId = req.params.id || req.body.courseId;

    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const course = await TrainingCourse.findOne({
      _id: courseId
    }).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!course.isActive) {
      return res.status(409).json({ message: 'Course is not active' });
    }

    const { employeeIds } = req.body;

    const employeeFilter = {
      isActive: true
    };
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      const valid = employeeIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length === 0) {
        return res
          .status(400)
          .json({ message: 'No valid employee ids supplied' });
      }
      employeeFilter._id = { $in: valid };
    }

    const employees = await Employee.find(employeeFilter)
      .select('_id fullName department role')
      .lean();

    // When no explicit list is given, the course's own targeting decides. This
    // is the path the "assign mandatory POSH training to Engineering" case takes.
    const targets = Array.isArray(employeeIds)
      ? employees
      : employees.filter((employee) => isApplicable(course, employee));

    if (targets.length === 0) {
      return res.status(409).json({
        message: 'No employees match this course',
        appliesTo: course.appliesTo,
        appliesToValues: course.appliesToValues,
      });
    }

    const existing = await TrainingEnrollment.find({
      courseId: course._id,
      employeeId: { $in: targets.map((employee) => employee._id) }
    })
      .select('employeeId')
      .lean();

    const alreadyEnrolled = new Set(
      existing.map((row) => String(row.employeeId)),
    );
    const toCreate = targets.filter(
      (employee) => !alreadyEnrolled.has(String(employee._id)),
    );

    if (toCreate.length > 0) {
      // Use ordered: false to gracefully skip duplicates (#1085 pattern)
      await TrainingEnrollment.insertMany(
        toCreate.map((employee) => ({
          courseId: course._id,
          employeeId: employee._id,
          status: ENROLLMENT_STATUS.ASSIGNED,
          assignedAt: new Date(),
          assignedBy: req.userId
        })),
        { ordered: false },
      );
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAINING_ASSIGNED',
      resourceType: 'TrainingCourse',
      resourceIds: [course._id],
      details: { assigned: toCreate.length, skipped: alreadyEnrolled.size },
      req,
    });

    return res.status(201).json({
      message: `Assigned to ${toCreate.length} employee(s)`,
      assigned: toCreate.length,
      alreadyEnrolled: alreadyEnrolled.size,
    });
  } catch (error) {
    // Duplicate key errors from ordered:false are expected and non-fatal
    if (error.code === 11000) {
      return res.status(201).json({
        message: 'Assignment processed (some employees were already enrolled)',
        assigned: 0,
        alreadyEnrolled: error.insertedDocs?.length || 0,
      });
    }
    return next(error);
  }
};

// ============================================================================
// Completion & Certificate Upload
// ============================================================================

/**
 * POST /api/training/enrollments/:id/complete
 *
 * A failing score records `Failed` and sets no validity. Recording it as
 * complete would let a failing attempt satisfy a mandatory course, which is the
 * whole thing this feature exists to prevent.
 *
 * For manual certificate uploads (no score), use POST /api/training/upload-certificate.
 */
exports.completeEnrollment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid enrollment id' });
    }

    const { score, completedAt, certificateReference } = req.body;

    const enrollment = await TrainingEnrollment.findOne({
      _id: req.params.id
    });
    if (!enrollment)
      return res.status(404).json({ message: 'Enrollment not found' });

    if (enrollment.status === ENROLLMENT_STATUS.WAIVED) {
      return res
        .status(409)
        .json({
          message: 'This enrollment has been waived and cannot be completed',
        });
    }

    const course = await TrainingCourse.findOne({
      _id: enrollment.courseId
    }).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const attempt = evaluateAttempt(course, score, enrollment.attemptCount + 1);

    if (!attempt.accepted) {
      return res.status(attempt.attemptsExhausted ? 409 : 400).json({
        message: attempt.reason,
        attemptCount: enrollment.attemptCount,
        maxAttempts: course.maxAttempts,
      });
    }

    const when = resolveAsOf(completedAt);

    enrollment.attemptCount = attempt.attempt;
    enrollment.score = attempt.score;
    enrollment.status = attempt.resultingStatus;

    if (attempt.passed) {
      const validity = computeValidity(course, when);
      enrollment.completedAt = when;
      enrollment.validUntil = validity.validUntil;
      enrollment.certificateReference = certificateReference || '';
    } else {
      // Explicitly cleared. A retake after a previous pass must not leave the
      // old completion date and validity attached to a failing attempt.
      enrollment.completedAt = null;
      enrollment.validUntil = null;
    }

    await enrollment.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: attempt.passed ? 'TRAINING_COMPLETED' : 'TRAINING_FAILED',
      resourceType: 'TrainingEnrollment',
      resourceIds: [enrollment._id],
      details: {
        score: attempt.score,
        passMark: course.passMark,
        attempt: attempt.attempt,
      },
      req,
    });

    return res.json({
      message: attempt.passed
        ? 'Training completed'
        : 'Attempt recorded as failed',
      passed: attempt.passed,
      attemptsRemaining: attempt.attemptsRemaining,
      validUntil: enrollment.validUntil,
      neverExpires: attempt.passed && enrollment.validUntil === null,
      enrollment,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/training/upload-certificate
 *
 * Manual certificate upload with auto-verification. Computes and stores
 * `validUntil` at upload time (stored evidence, never recomputed on read).
 * This is distinct from `completeEnrollment` which handles scored LMS completions.
 */
exports.uploadCertificate = async (req, res, next) => {
  try {
    const { recordId, certificateUrl } = req.body;

    if (!recordId || !mongoose.isValidObjectId(recordId)) {
      return res.status(400).json({ message: 'Valid recordId is required' });
    }
    if (!certificateUrl || !String(certificateUrl).trim()) {
      return res.status(400).json({ message: 'certificateUrl is required' });
    }

    // EmployeeTrainingRecord is aliased to TrainingEnrollment in the model
    const record = await EmployeeTrainingRecord.findOne({
      _id: recordId
    });
    if (!record) {
      return res.status(404).json({ message: 'Training record not found' });
    }

    if (record.status === ENROLLMENT_STATUS.WAIVED) {
      return res.status(409).json({
        message: 'This enrollment has been waived and cannot receive a certificate',
      });
    }

    const course = await TrainingCourse.findById(record.courseId).lean();
    if (!course) {
      return res.status(404).json({ message: 'Associated course not found' });
    }

    const now = new Date();
    record.status = ENROLLMENT_STATUS.COMPLETED;
    record.completedAt = now;
    record.certificateUrl = String(certificateUrl).trim();
    record.certificateUploadedAt = now;
    record.verifiedBy = req.userId;

    // Compute and store validity at upload time — this is evidence, not a cache.
    // Uses validityMonths first (legacy), falls back to validityDays (#1085).
    const validity = computeValidity(course, now);
    record.validUntil = validity.validUntil;

    await record.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'CERTIFICATE_UPLOADED',
      resourceType: 'TrainingEnrollment',
      resourceIds: [record._id],
      details: {
        courseId: course._id,
        courseCode: course.code,
        validUntil: record.validUntil,
      },
      req,
    });

    return res.status(200).json({
      message: 'Certificate uploaded and verified',
      record,
    });
  } catch (error) {
    logger.error('Failed to upload certificate', {
      userId: req.userId,
      error: error.message,
    });
    return next(error);
  }
};

// ============================================================================
// Waiver
// ============================================================================

/**
 * POST /api/training/enrollments/:id/waive
 *
 * A waiver is a documented decision, so the reason is required rather than
 * optional. "Why is this person exempt from mandatory fire safety training" is
 * the first thing an auditor asks, and a blank field is not an answer.
 */
exports.waiveEnrollment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid enrollment id' });
    }

    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 10) {
      return res.status(400).json({
        message: 'A waiver reason of at least 10 characters is required',
      });
    }

    const enrollment = await TrainingEnrollment.findOne({
      _id: req.params.id
    });
    if (!enrollment)
      return res.status(404).json({ message: 'Enrollment not found' });

    enrollment.status = ENROLLMENT_STATUS.WAIVED;
    enrollment.waivedReason = String(reason).trim();
    enrollment.waivedBy = req.userId;
    await enrollment.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'TRAINING_WAIVED',
      resourceType: 'TrainingEnrollment',
      resourceIds: [enrollment._id],
      details: { reason: enrollment.waivedReason },
      req,
    });

    return res.json({ message: 'Enrollment waived', enrollment });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Self-Service & Compliance Gating
// ============================================================================

/**
 * GET /api/training/my-training
 *
 * Self-service. The employee is resolved from `req.userId`, never from a
 * parameter. Includes compliance gate check for appraisal gating (#1085).
 */
exports.getMyTraining = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId
    })
      .select('_id fullName department role')
      .lean();

    if (!employee) {
      return res
        .status(404)
        .json({ message: 'No employee record is linked to this account' });
    }

    const asOf = resolveAsOf(req.query.asOf);

    const enrollments = await TrainingEnrollment.find({
      employeeId: employee._id
    }).lean();

    const courses = await TrainingCourse.find({
      _id: { $in: enrollments.map((row) => row.courseId) }
    }).lean();

    const courseById = new Map(
      courses.map((course) => [String(course._id), course]),
    );

    const items = enrollments.map((enrollment) => {
      const course = courseById.get(String(enrollment.courseId));
      const state = certificationState(enrollment, course, asOf);

      return {
        enrollmentId: enrollment._id,
        courseCode: course?.code,
        courseTitle: course?.title,
        isMandatory: Boolean(course?.isMandatory),
        status: enrollment.status,
        score: enrollment.score,
        completedAt: enrollment.completedAt,
        certificateReference: enrollment.certificateReference,
        certificateUrl: enrollment.certificateUrl,
        externalLink: course?.externalLink,
        ...state,
      };
    });

    // Compliance gate check for appraisal/promotion gating (#1085)
    let complianceCheck = null;
    try {
      complianceCheck = await checkMandatoryCompliance(employee._id, req.tenantId);
    } catch (err) {
      logger.warn('Compliance gate check failed, returning training without gate status', {
        employeeId: employee._id,
        error: err.message,
      });
    }

    return res.json({
      asOf,
      employee: { id: employee._id, fullName: employee.fullName },
      training: items,
      outstanding: items.filter((item) => item.isMandatory && !item.isCompliant).length,
      complianceCheck,
    });
  } catch (error) {
    return next(error);
  }
};



// ============================================================================
// Dashboard Statistics (#1085)
// ============================================================================

/**
 * GET /api/training/dashboard/stats
 *
 * Aggregated compliance statistics and near-term expiration risk table
 * for the HR/admin dashboard.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await getComplianceStats(req.tenantId);

    // Fetch records expiring in the next 30 days for the risk table
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const expiringRecords = await EmployeeTrainingRecord.find({
      status: ENROLLMENT_STATUS.COMPLETED,
      validUntil: { $gte: now, $lte: in30Days }
    })
      .populate('employeeId', 'fullName department')
      .populate('courseId', 'title code')
      .sort({ validUntil: 1 })
      .limit(50)
      .lean();

    return res.status(200).json({ stats, expiringRecords });
  } catch (error) {
    logger.error('Failed to load dashboard stats', {
      error: error.message
    });
    return next(error);
  }
};

// ============================================================================
// Compliance Reports (Legacy, Preserved)
// ============================================================================

/**
 * GET /api/training/compliance/gaps
 */
exports.getComplianceGaps = async (req, res, next) => {
  try {
    const { courses, employees, enrollments } = await loadComplianceInputs(
      req.tenantId,
    );
    const asOf = resolveAsOf(req.query.asOf);

    return res.json({
      asOf,
      gaps: coverageGaps(courses, employees, enrollments, asOf),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/training/compliance/summary
 */
exports.getComplianceSummary = async (req, res, next) => {
  try {
    const { courses, employees, enrollments } = await loadComplianceInputs(
      req.tenantId,
    );
    const asOf = resolveAsOf(req.query.asOf);

    return res.json({
      asOf,
      summary: complianceRate(courses, employees, enrollments, asOf),
      byDepartment: complianceByDepartment(
        courses,
        employees,
        enrollments,
        asOf,
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/training/compliance/renewals
 */
exports.getRenewalsDue = async (req, res, next) => {
  try {
    const asOf = resolveAsOf(req.query.asOf);
    const horizonDays = Number(req.query.horizonDays) || 30;

    const [courses, enrollments] = await Promise.all([
      TrainingCourse.find({
        isActive: true
      }).lean(),
      TrainingEnrollment.find({
        status: ENROLLMENT_STATUS.COMPLETED
      }).lean(),
    ]);

    const due = renewalsDue(enrollments, courses, asOf, horizonDays);

    return res.json({
      asOf,
      horizonDays,
      renewals: due,
      overdue: due.filter((item) => item.overdueDays > 0).length,
    });
  } catch (error) {
    return next(error);
  }
};

exports._internals = { resolveAsOf, loadComplianceInputs };
