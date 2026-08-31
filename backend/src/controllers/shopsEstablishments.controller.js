/**
 * @fileoverview Shops and Commercial Establishments Acts (#1972).
 *
 * Three decisions carry this controller.
 *
 * **It raises the headcount amendment from the employee count itself.** The
 * band sits on the certificate, `employee.controller.js` changes it with an
 * ordinary hire, and nothing connects the two. `syncHeadcount` reads the
 * establishment's current count, resolves the band, and — where it differs from
 * the band on the certificate — records the divergence **dated from when it
 * arose** rather than from now. Dating it from now would turn a change made in
 * March into a deadline in June.
 *
 * **It reports a lapsed certificate as trading unregistered, not as a renewal
 * that is late.** They are different findings with different consequences, and a
 * queue showing them as one row lets the serious one be cleared alongside the
 * trivial one. The two never share a code.
 *
 * **It owns nothing in the roster.** It reads shifts to evaluate the weekly
 * holiday and the notified hours, and reports where a shift is rostered against
 * a day the establishment is closed. It does not move the shift — the Act makes
 * that a compliance question for the employer rather than a scheduling error for
 * the product to correct.
 *
 * Everything that decides a window, a cycle or a band is in
 * `utils/shopsEstablishments.js`.
 */

const mongoose = require('mongoose');

const {
  EstablishmentRegistration,
  CertificateParticular,
  EstablishmentClosure,
} = require('../models/shopsEstablishments.model');
const Employee = require('../models/employee.model');
const {
  STATE_RULES,
  PARTICULAR,
  REGISTRATION_STATE,
  LAPSED_IS_OPERATING_UNREGISTERED,
  WEEKLY_HOLIDAY_IS_TWO_TESTS,
  resolveRules,
  headcountBand,
  registrationPosition,
  assessEstablishment,
} = require('../utils/shopsEstablishments');
const eventBus = require('../services/event.service');

/**
 * @param {*} value
 * @returns {Date|null}
 */
function readDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The particulars for a registration, shaped for the engine.
 *
 * @param {Array<object>} rows
 * @returns {{onCertificate: object, current: object, changedOn: object}}
 */
function shapeParticulars(rows) {
  const onCertificate = {};
  const current = {};
  const changedOn = {};

  for (const row of rows) {
    onCertificate[row.particular] = row.onCertificate;
    current[row.particular] = row.current;
    if (row.changedOn) changedOn[row.particular] = row.changedOn;
  }

  return { onCertificate, current, changedOn };
}

/**
 * GET /api/establishments/rules
 */
exports.getRules = async (req, res, next) => {
  try {
    return res.json({
      states: STATE_RULES,
      particulars: PARTICULAR,
      registrationStates: REGISTRATION_STATE,
      notes: {
        lapsedIsOperatingUnregistered: LAPSED_IS_OPERATING_UNREGISTERED,
        weeklyHolidayIsTwoTests: WEEKLY_HOLIDAY_IS_TWO_TESTS,
      },
      note: 'There is no national Act. The registration window, the renewal cycle, the amendment period and the hours are all state-made and they genuinely differ — a state not listed here has no rules on file rather than default ones.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/establishments/registrations
 *
 * `commencedOn` is required whether or not the establishment has registered.
 * The window runs from it, and an establishment that never registered has no
 * registration date at all.
 */
exports.recordRegistration = async (req, res, next) => {
  try {
    const establishment = String(req.body.establishment || '').trim();
    if (!establishment) {
      return res.status(400).json({ message: 'establishment is required' });
    }

    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    if (!state) {
      return res.status(400).json({ message: 'state is required' });
    }

    const commencedOn = readDate(req.body.commencedOn);
    if (!commencedOn) {
      return res.status(400).json({
        message:
          'commencedOn must be a valid date. The registration window runs from commencement, so an establishment with no commencement date has no deadline the module can compute.',
      });
    }

    const rules = resolveRules(state);

    const registration = await EstablishmentRegistration.findOneAndUpdate(
      { tenantId: req.tenantId, establishment },
      {
        $set: {
          state,
          commencedOn,
          registeredOn: readDate(req.body.registeredOn),
          certificateNumber: String(req.body.certificateNumber || '').trim(),
          validTo: readDate(req.body.validTo),
          closingDay:
            req.body.closingDay === undefined || req.body.closingDay === null
              ? null
              : Number(req.body.closingDay),
          alsoCoveredByFactoriesAct: Boolean(
            req.body.alsoCoveredByFactoriesAct,
          ),
          entityId: mongoose.isValidObjectId(req.body.entityId)
            ? req.body.entityId
            : undefined,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const position = rules
      ? registrationPosition({
          ...registration.toObject(),
          rules,
          asAt: new Date(),
        })
      : null;

    if (position) {
      registration.lastKnownState = position.state;
      await registration.save();
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESTABLISHMENT_REGISTRATION_RECORDED',
      resourceType: 'EstablishmentRegistration',
      resourceIds: [registration._id],
      details: {
        establishment,
        state,
        commencedOn,
        registeredOn: registration.registeredOn,
        // Named because the cycle is what the expiry is derived from where the
        // certificate does not print one, and it differs by a decade between
        // states.
        renewalYears: rules?.renewalYears ?? null,
        state_: position?.state || null,
      },
      req,
    });

    return res.status(201).json({
      registration,
      position,
      rules,
      note: rules
        ? null
        : `No rules are on file for ${state}. The registration window and the renewal cycle cannot be computed until they are, and defaulting them would tell you a certificate is valid when it may not be.`,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/establishments/registrations/:id/particulars
 *
 * Records what a particular says on the certificate and what the establishment's
 * value actually is, with the date they diverged.
 */
exports.recordParticular = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid registration id' });
    }

    if (!Object.values(PARTICULAR).includes(req.body.particular)) {
      return res.status(400).json({
        message: `particular must be one of ${Object.values(PARTICULAR).join(', ')}. The amendment obligation attaches to these and not to any change in the business.`,
      });
    }

    const registration = await EstablishmentRegistration.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const record = await CertificateParticular.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        registrationId: registration._id,
        particular: req.body.particular,
      },
      {
        $set: {
          onCertificate: String(req.body.onCertificate ?? '').trim(),
          current: String(req.body.current ?? '').trim(),
          changedOn: readDate(req.body.changedOn),
          notifiedOn: readDate(req.body.notifiedOn),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESTABLISHMENT_PARTICULAR_RECORDED',
      resourceType: 'CertificateParticular',
      resourceIds: [record._id],
      details: {
        establishment: registration.establishment,
        particular: record.particular,
        onCertificate: record.onCertificate,
        current: record.current,
        // The field the whole clock runs from — see the model.
        changedOn: record.changedOn,
      },
      req,
    });

    return res.status(201).json({ particular: record });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/establishments/registrations/:id/sync-headcount
 *
 * The bridge nothing else builds. Reads the establishment's current employee
 * count, resolves the band, and records the divergence against the certificate.
 *
 * Deliberately does **not** date the change from now where the caller supplies
 * a date: an ordinary hire in March started the clock in March, and a fresh
 * fifteen days would report an obligation already in default as one that can
 * still be met.
 */
exports.syncHeadcount = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid registration id' });
    }

    const registration = await EstablishmentRegistration.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const rules = resolveRules(registration.state);
    if (!rules) {
      return res.status(409).json({
        message: `No rules are on file for ${registration.state}, so the headcount bands the certificate uses are unknown. States band the count differently and guessing would raise an amendment that is not owed — or miss one that is.`,
      });
    }

    const headcount = await Employee.countDocuments({ tenantId: req.tenantId });
    const band = headcountBand(headcount, rules);

    const existing = await CertificateParticular.findOne({
      tenantId: req.tenantId,
      registrationId: registration._id,
      particular: PARTICULAR.HEADCOUNT_BAND,
    });

    const changedOn =
      readDate(req.body?.changedOn) ||
      // Falls back to the existing divergence date rather than to today, so a
      // repeated sync does not keep restarting the clock.
      existing?.changedOn ||
      new Date();

    const record = await CertificateParticular.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        registrationId: registration._id,
        particular: PARTICULAR.HEADCOUNT_BAND,
      },
      {
        $set: { current: band?.label || String(headcount), changedOn },
        $setOnInsert: {
          onCertificate: String(req.body?.onCertificate ?? '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESTABLISHMENT_HEADCOUNT_SYNCED',
      resourceType: 'CertificateParticular',
      resourceIds: [record._id],
      details: {
        establishment: registration.establishment,
        headcount,
        band: band?.label || null,
        onCertificate: record.onCertificate,
        changedOn,
      },
      req,
    });

    return res.json({
      headcount,
      band,
      particular: record,
      note: 'The count comes from the employee roll. The band on the certificate is what an amendment is measured against, and an ordinary hire that crosses a band starts a clock nothing in the hiring flow raises.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/establishments/registrations/:id/closure
 *
 * Closure is an obligation rather than the absence of one — see the model.
 */
exports.recordClosure = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid registration id' });
    }

    const registration = await EstablishmentRegistration.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const closedOn = readDate(req.body.closedOn);
    if (!closedOn) {
      return res.status(400).json({ message: 'closedOn must be a valid date' });
    }

    const closure = await EstablishmentClosure.findOneAndUpdate(
      { tenantId: req.tenantId, registrationId: registration._id },
      {
        $set: {
          closedOn,
          intimatedOn: readDate(req.body.intimatedOn),
          surrenderedOn: readDate(req.body.surrenderedOn),
          reason: String(req.body.reason || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESTABLISHMENT_CLOSURE_RECORDED',
      resourceType: 'EstablishmentClosure',
      resourceIds: [closure._id],
      details: {
        establishment: registration.establishment,
        closedOn,
        // Both, because an establishment commonly intimates and forgets to
        // surrender, and the two have the same deadline.
        intimatedOn: closure.intimatedOn,
        surrenderedOn: closure.surrenderedOn,
      },
      req,
    });

    return res.status(201).json({ closure });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/establishments/expiring
 *
 * Certificates within the horizon, and the lapsed ones ahead of them. There is
 * no notice from the department, so this is the only thing that raises it.
 */
exports.listExpiring = async (req, res, next) => {
  try {
    const withinDays = Number(req.query.withinDays) || 90;
    const horizon = new Date(Date.now() + withinDays * 86400000);

    const registrations = await EstablishmentRegistration.find({
      tenantId: req.tenantId,
      validTo: { $ne: null, $lte: horizon },
    })
      .sort({ validTo: 1 })
      .lean();

    return res.json({
      withinDays,
      registrations: registrations.map((registration) => {
        const rules = resolveRules(registration.state);
        return {
          ...registration,
          position: rules
            ? registrationPosition({ ...registration, rules, asAt: new Date() })
            : null,
        };
      }),
      note: LAPSED_IS_OPERATING_UNREGISTERED,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/establishments/position
 *
 * One establishment's whole position.
 */
exports.getPosition = async (req, res, next) => {
  try {
    const establishment = String(req.query.establishment || '').trim();

    const registration = await EstablishmentRegistration.findOne({
      tenantId: req.tenantId,
      establishment,
    }).lean();

    if (!registration) {
      return res.json({
        establishment,
        registration: null,
        // Not an error. An establishment with no registration record is exactly
        // the one the window obligation is about.
        note: 'No registration is on file for this establishment. The window runs from the day it commenced work, so an establishment with no record is the case the obligation is about rather than a missing page.',
      });
    }

    const particulars = await CertificateParticular.find({
      tenantId: req.tenantId,
      registrationId: registration._id,
    }).lean();

    const closure = await EstablishmentClosure.findOne({
      tenantId: req.tenantId,
      registrationId: registration._id,
    }).lean();

    const result = assessEstablishment({
      state: registration.state,
      registration: {
        commencedOn: registration.commencedOn,
        registeredOn: registration.registeredOn,
        validTo: registration.validTo,
        closingDay: registration.closingDay,
        closedOn: closure?.closedOn,
        intimatedOn: closure?.intimatedOn,
        surrenderedOn: closure?.surrenderedOn,
      },
      particulars: shapeParticulars(particulars),
      shifts: Array.isArray(req.body?.shifts) ? req.body.shifts : [],
      nightEngagements: Array.isArray(req.body?.nightEngagements)
        ? req.body.nightEngagements
        : [],
      alsoCoveredByFactoriesAct: registration.alsoCoveredByFactoriesAct,
      asAt: new Date(),
    });

    return res.json({ establishment, registration, result });
  } catch (error) {
    return next(error);
  }
};
