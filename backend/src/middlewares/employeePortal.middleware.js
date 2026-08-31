/**
 * Employee Portal Middleware - Issue #1114
 *
 * Guards the /api/self/* routes.
 *
 * Two things it enforces:
 *  1. Only accounts with accountType === 'EMPLOYEE' can proceed.
 *  2. req.employeeId is populated from the Employee record tied to req.userId.
 *     This prevents an employee from accessing another employee's data
 *     by guessing an ObjectId in the URL.
 */
'use strict';

const Employee        = require('../models/employee.model');
const logger          = require('../utils/logger');

async function employeePortalGuard(req, res, next) {
  try {
    if (req.accountType !== 'EMPLOYEE') {
      return res.status(403).json({ message: 'This endpoint is for employee accounts only.' });
    }

    const employee = await Employee.findOne({
      userId: req.userId,
    }).select('_id');

    if (!employee) {
      return res.status(404).json({ message: 'No employee record found for this account.' });
    }

    req.employeeId = employee._id;
    next();
  } catch (err) {
    logger.error('employeePortalGuard error', { userId: req.userId, error: err.message });
    return res.status(500).json({ message: 'Authorization check failed.' });
  }
}

module.exports = { employeePortalGuard };