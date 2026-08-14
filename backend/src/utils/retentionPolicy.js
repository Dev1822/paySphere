/**
 * @fileoverview Data Retention & GDPR Right-to-be-Forgotten Policy Engine
 * @description Provides cryptographic PII anonymization / pseudonymization for GDPR Article 17 compliance
 * and statutory data retention period evaluation for archived employee records.
 */

'use strict';

const crypto = require('crypto');

/**
 * Anonymizes Personally Identifiable Information (PII) of an employee record.
 * Preserves non-identifiable financial ledger keys while redacting direct personal identifiers.
 *
 * @param {object} employee
 * @returns {object} Anonymized fields payload
 */
function anonymizeEmployeePII(employee = {}) {
  const seed = `${employee._id || ''}-${employee.email || ''}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const shortId = hash.slice(0, 8);

  return {
    fullName: `Anonymized Employee ${shortId}`,
    firstName: 'Anonymized',
    lastName: shortId,
    email: `anonymized-${shortId}@pay-sphere.internal`,
    phone: '0000000000',
    emergencyContact: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    pan: 'ANONPAN000',
    bankAccountNumber: '0000000000',
    ifscCode: 'ANON0000000',
    aadhaarNumber: '000000000000',
    isAnonymized: true,
    anonymizedAt: new Date(),
  };
}

/**
 * Evaluates whether an archived employee record has surpassed the statutory retention window.
 * Default statutory retention window: 7 years (2555 days) for Indian tax & labor compliance.
 *
 * @param {object} employee
 * @param {number} [retentionYears=7]
 * @param {Date|string} [now=new Date()]
 * @returns {object}
 */
function evaluateRetentionEligibility(employee = {}, retentionYears = 7, now = new Date()) {
  const deletedAt = employee.deletedAt ? new Date(employee.deletedAt) : null;
  if (!deletedAt || Number.isNaN(deletedAt.getTime())) {
    return {
      isEligibleForPurge: false,
      reason: 'Employee is not marked as deleted / archived',
      daysArchived: 0,
      retentionDaysRequired: retentionYears * 365,
    };
  }

  const currentTime = new Date(now).getTime();
  const deletedTime = deletedAt.getTime();
  const daysArchived = Math.floor((currentTime - deletedTime) / (1000 * 60 * 60 * 24));
  const retentionDaysRequired = retentionYears * 365;

  const isEligibleForPurge = daysArchived >= retentionDaysRequired;

  return {
    isEligibleForPurge,
    deletedDate: deletedAt,
    daysArchived,
    retentionDaysRequired,
    remainingDays: Math.max(0, retentionDaysRequired - daysArchived),
  };
}

module.exports = {
  anonymizeEmployeePII,
  evaluateRetentionEligibility,
};
