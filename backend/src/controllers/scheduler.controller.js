const mongoose = require("mongoose");
const ReportSchedule = require("../models/reportSchedule.model");
const {
  REPORT_TYPES,
  FREQUENCIES,
  MAX_RECIPIENTS,
} = require("../models/reportSchedule.model");
const { isValidEmail } = require("../utils/validators");
const logger = require("../utils/logger");

/**
 * Report schedule CRUD (#666).
 *
 * `createSchedule` used to take `reportType`, `frequency`, `recipients` and
 * `config` straight from the body and hand them to `save()`. Every invalid
 * value therefore arrived as a mongoose ValidationError, which error.middleware
 * turns into a flat "Validation error. Please check the input data." — no
 * indication of which field, or which address, was the problem.
 *
 * Since the recipients validator itself was broken (a double-escaped regex no
 * real address could match), *every* create failed that way. That is fixed in
 * the model; the validation here exists so a caller finds out what they got
 * wrong.
 */

/** The datasets a custom report may draw from. */
const CUSTOM_DATASETS = ["employees", "payroll"];

/** The most columns a custom report may select. */
const MAX_COLUMNS = 50;

/**
 * Normalise and validate a recipient list.
 *
 * Addresses were stored exactly as typed, so `HR@acme.com`, `hr@acme.com ` and
 * `hr@acme.com` were three separate recipients and the same person received
 * three copies of every report.
 *
 * @param {unknown} recipients
 * @returns {{ok: true, recipients: string[]} | {ok: false, message: string}}
 */
function normalizeRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return {
      ok: false,
      message: "recipients must be a non-empty array of email addresses",
    };
  }

  if (recipients.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      message: `A schedule cannot have more than ${MAX_RECIPIENTS} recipients`,
    };
  }

  const invalid = [];
  const seen = new Set();

  for (const raw of recipients) {
    if (typeof raw !== "string" || !isValidEmail(raw)) {
      invalid.push(String(raw));
      continue;
    }

    seen.add(raw.trim().toLowerCase());
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid recipient email address: ${invalid.slice(0, 5).join(", ")}`,
    };
  }

  return { ok: true, recipients: [...seen] };
}

/**
 * Validate the optional custom-report configuration.
 *
 * It was accepted verbatim from the body, so `config.columns` could be an
 * arbitrarily long array of arbitrary values — stored, and later fed to a query
 * builder.
 *
 * @param {unknown} config
 * @returns {{ok: true, config: object|undefined} | {ok: false, message: string}}
 */
function validateConfig(config) {
  if (config === undefined || config === null) {
    return { ok: true, config: undefined };
  }

  if (typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, message: "config must be an object" };
  }

  if (config.dataset !== undefined && !CUSTOM_DATASETS.includes(config.dataset)) {
    return {
      ok: false,
      message: `config.dataset must be one of: ${CUSTOM_DATASETS.join(", ")}`,
    };
  }

  if (config.columns !== undefined) {
    if (!Array.isArray(config.columns)) {
      return { ok: false, message: "config.columns must be an array" };
    }

    if (config.columns.length > MAX_COLUMNS) {
      return {
        ok: false,
        message: `config.columns cannot contain more than ${MAX_COLUMNS} entries`,
      };
    }

    if (!config.columns.every((c) => typeof c === "string" && c.trim() !== "")) {
      return {
        ok: false,
        message: "every entry in config.columns must be a non-empty string",
      };
    }
  }

  if (config.filters !== undefined && !Array.isArray(config.filters)) {
    return { ok: false, message: "config.filters must be an array" };
  }

  return { ok: true, config };
}

exports.createSchedule = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);

    const { reportType, frequency, recipients, config } = req.body || {};

    // Checked here rather than left to the schema enum, so the caller is told
    // what the allowed values are instead of getting a flat 400.
    if (!REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        message: `reportType must be one of: ${REPORT_TYPES.join(", ")}`,
      });
    }

    if (!FREQUENCIES.includes(frequency)) {
      return res.status(400).json({
        message: `frequency must be one of: ${FREQUENCIES.join(", ")}`,
      });
    }

    const parsedRecipients = normalizeRecipients(recipients);
    if (!parsedRecipients.ok) {
      return res.status(400).json({ message: parsedRecipients.message });
    }

    const parsedConfig = validateConfig(config);
    if (!parsedConfig.ok) {
      return res.status(400).json({ message: parsedConfig.message });
    }

    const schedule = new ReportSchedule({
      reportType,
      frequency,
      recipients: parsedRecipients.recipients,
      config: parsedConfig.config,
      // Both: `createdBy` records who scheduled the report, `tenantId` decides
      // who can see it. #585 dropped the first while the schema still required
      // it, so this save() threw on every call (#613).
      createdBy: req.userId,
      tenantId,
    });

    await schedule.save();

    logger.info("Report schedule created", {
      scheduleId: String(schedule._id),
      reportType,
      frequency,
      recipientCount: parsedRecipients.recipients.length,
      userId: req.userId,
    });

    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

exports.getSchedules = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);

    const schedules = await ReportSchedule.find({ tenantId }).sort("-createdAt");

    res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

exports.deleteSchedule = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const { id } = req.params;

    // An unparseable id used to reach findOneAndDelete and throw a CastError,
    // which surfaces as a 500 for what is plainly a bad request.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid schedule id format" });
    }

    const schedule = await ReportSchedule.findOneAndDelete({ _id: id, tenantId });

    if (!schedule) {
      // Indistinguishable from "does not exist", so a caller cannot probe for
      // another company's schedule ids.
      return res.status(404).json({ message: "Schedule not found" });
    }

    logger.info("Report schedule deleted", {
      scheduleId: String(schedule._id),
      userId: req.userId,
    });

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    next(error);
  }
};

exports.normalizeRecipients = normalizeRecipients;
exports.validateConfig = validateConfig;
exports.CUSTOM_DATASETS = CUSTOM_DATASETS;
exports.MAX_COLUMNS = MAX_COLUMNS;
