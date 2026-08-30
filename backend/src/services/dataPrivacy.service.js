const Employee = require('../models/employee.model');
const eventBus = require('./event.service');

/**
 * Privileged PII Decryption/Unmasking Handler.
 * Fetches unmasked PII values and logs a compliance audit trail event.
 */
async function requestUnmaskedPII({ userId, tenantId, employeeId, fields = [], reason, userRole, req }) {
  // Query employee bypassing the masking plugin (no userRole set in options)
  const employee = await Employee.findOne({ _id: employeeId, tenantId }).lean();
  if (!employee) {
    throw new Error('Employee not found');
  }

  const unmaskedData = {};
  for (const field of fields) {
    if (employee[field] !== undefined) {
      unmaskedData[field] = employee[field];
    }
  }

  // Log the privileged audit trail event
  eventBus.emit('AUDIT_LOG', {
    userId,
    action: 'UNMASKED_PII_VIEWED',
    resourceType: 'Employee',
    resourceIds: [employeeId],
    details: {
      fields,
      reason,
      userRole,
      ipAddress: req?.ip || 'unknown',
    },
    req,
  });

  return unmaskedData;
}

module.exports = {
  requestUnmaskedPII,
};
