/**
 * @fileoverview Document Request Utility Functions
 * @description Helpers for validation, status transitions, TAT computation,
 *   request number generation, and document metadata.
 */

/**
 * Allowed status transitions for the document request workflow.
 * Key = current status, value = array of statuses it can transition to.
 */
const VALID_TRANSITIONS = {
  Draft: ['Submitted', 'Cancelled'],
  Submitted: ['ManagerReview', 'Cancelled'],
  ManagerReview: ['ManagerApproved', 'ManagerRejected'],
  ManagerApproved: ['HRReview', 'Processing', 'ReadyForSignature'],
  ManagerRejected: ['Submitted', 'Cancelled'],
  HRReview: ['HROnHold', 'HRApproved', 'HRRejected'],
  HROnHold: ['HRReview', 'HRApproved', 'Cancelled'],
  HRApproved: ['Processing', 'ReadyForSignature'],
  HRRejected: ['Submitted', 'Cancelled'],
  Processing: ['ReadyForSignature', 'Signed', 'Delivered'],
  ReadyForSignature: ['Signed'],
  Signed: ['Delivered'],
  Delivered: [],
  Cancelled: [],
  Expired: [],
};

/**
 * Document category metadata for display and filtering.
 */
const CATEGORY_META = {
  Employment: {
    label: 'Employment Documents',
    icon: '🏢',
    description: 'Experience letters, employment verification, relieving letters',
  },
  Compensation: {
    label: 'Compensation Documents',
    icon: '💰',
    description: 'Salary certificates, CTC breakdowns, increment letters',
  },
  Tax: {
    label: 'Tax Documents',
    icon: '📊',
    description: 'Form 16, tax declarations, PAN card copies',
  },
  Legal: {
    label: 'Legal Documents',
    icon: '⚖️',
    description: 'NOC, bond letters, legal undertakings',
  },
  Immigration: {
    label: 'Immigration Documents',
    icon: '✈️',
    description: 'Employment verification for visas, immigration letters',
  },
  Custom: {
    label: 'Custom Documents',
    icon: '📄',
    description: 'Any other document request',
  },
};

/**
 * Validates whether a status transition is allowed.
 *
 * @param {string} currentStatus - The current status of the request.
 * @param {string} targetStatus - The desired target status.
 * @returns {{ allowed: boolean, reason: string }}
 */
function validateTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return {
      allowed: false,
      reason: `Unknown current status: ${currentStatus}`,
    };
  }
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * Generates a unique request number for a document request.
 * Format: DOC-YYYYMM-XXXX (e.g., DOC-202608-0042)
 *
 * @param {number} sequenceNumber - Auto-incrementing sequence number.
 * @param {Date} [date] - Reference date (defaults to now).
 * @returns {string}
 */
function generateRequestNumber(sequenceNumber, date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(4, '0');
  return `DOC-${year}${month}-${seq}`;
}

/**
 * Calculates the expected delivery date based on standard TAT.
 * Excludes weekends (Saturday/Sunday) from the count.
 *
 * @param {Date} fromDate - Start date.
 * @param {number} tatDays - Business days for turnaround.
 * @returns {Date}
 */
function calculateExpectedDeliveryDate(fromDate, tatDays) {
  const date = new Date(fromDate);
  let remaining = tatDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  return date;
}

/**
 * Calculates how many business days have elapsed since a given date.
 *
 * @param {Date} fromDate - Start date.
 * @param {Date} [toDate] - End date (defaults to now).
 * @returns {number} Business days elapsed.
 */
function calculateBusinessDaysElapsed(fromDate, toDate) {
  const end = toDate || new Date();
  const start = new Date(fromDate);
  let count = 0;

  while (start < end) {
    start.setDate(start.getDate() + 1);
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * Determines the SLA status of a request.
 *
 * @param {Date} expectedDeliveryDate - The expected delivery date.
 * @param {string} currentStatus - Current status of the request.
 * @returns {{ slaStatus: string, daysRemaining: number | null, isOverdue: boolean }}
 */
function getSLAStatus(expectedDeliveryDate, currentStatus) {
  const completedStatuses = [
    'Delivered',
    'Signed',
    'Cancelled',
    'Expired',
  ];
  if (completedStatuses.includes(currentStatus)) {
    return { slaStatus: 'Completed', daysRemaining: null, isOverdue: false };
  }

  if (!expectedDeliveryDate) {
    return { slaStatus: 'Unknown', daysRemaining: null, isOverdue: false };
  }

  const now = new Date();
  const diffMs = new Date(expectedDeliveryDate) - now;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { slaStatus: 'Overdue', daysRemaining, isOverdue: true };
  }
  if (daysRemaining === 0) {
    return { slaStatus: 'DueToday', daysRemaining: 0, isOverdue: false };
  }
  if (daysRemaining <= 2) {
    return { slaStatus: 'AtRisk', daysRemaining, isOverdue: false };
  }
  return { slaStatus: 'OnTrack', daysRemaining, isOverdue: false };
}

/**
 * Validates field values against a template's required fields.
 *
 * @param {Array} requiredFields - Template required fields definition.
 * @param {Object} fieldValues - Submitted field values.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFieldValues(requiredFields, fieldValues) {
  const errors = [];

  if (!requiredFields || requiredFields.length === 0) {
    return { valid: true, errors };
  }

  for (const field of requiredFields) {
    const value = fieldValues[field.fieldName];

    if (!field.isOptional && (value === undefined || value === null || value === '')) {
      errors.push(`"${field.fieldLabel}" is required`);
    }

    if (value !== undefined && value !== null && value !== '') {
      if (field.fieldType === 'date') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`"${field.fieldLabel}" must be a valid date`);
        }
      }
      if (field.fieldType === 'select' && field.options.length > 0) {
        if (!field.options.includes(value)) {
          errors.push(
            `"${field.fieldLabel}" must be one of: ${field.options.join(', ')}`,
          );
        }
      }
      if (field.fieldType === 'text' && typeof value === 'string' && value.length > 500) {
        errors.push(`"${field.fieldLabel}" must not exceed 500 characters`);
      }
      if (field.fieldType === 'textarea' && typeof value === 'string' && value.length > 2000) {
        errors.push(`"${field.fieldLabel}" must not exceed 2000 characters`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formats a request summary for notifications or display.
 *
 * @param {Object} request - DocumentRequest document.
 * @param {string} employeeName - Employee name.
 * @param {string} templateName - Template name.
 * @returns {Object}
 */
function formatRequestSummary(request, employeeName, templateName) {
  return {
    id: request._id,
    requestNumber: request.requestNumber,
    employee: employeeName,
    document: templateName,
    category: request.fieldValues?.category || 'Employment',
    urgency: request.urgency,
    status: request.status,
    submittedAt: request.createdAt,
    expectedDeliveryDate: request.expectedDeliveryDate,
    notes: request.notes,
  };
}

/**
 * Checks if a request has exceeded its TAT and should be auto-escalated.
 *
 * @param {Object} request - DocumentRequest document.
 * @param {number} escalationThresholdDays - Days past TAT to escalate.
 * @returns {{ shouldEscalate: boolean, daysOverdue: number }}
 */
function checkForEscalation(request, escalationThresholdDays = 2) {
  if (!request.expectedDeliveryDate) {
    return { shouldEscalate: false, daysOverdue: 0 };
  }

  const completedStatuses = [
    'Delivered',
    'Signed',
    'Cancelled',
    'Expired',
  ];
  if (completedStatuses.includes(request.status)) {
    return { shouldEscalate: false, daysOverdue: 0 };
  }

  const now = new Date();
  const expected = new Date(request.expectedDeliveryDate);
  const diffMs = now - expected;
  const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    shouldEscalate: daysOverdue >= escalationThresholdDays,
    daysOverdue,
  };
}

module.exports = {
  VALID_TRANSITIONS,
  CATEGORY_META,
  validateTransition,
  generateRequestNumber,
  calculateExpectedDeliveryDate,
  calculateBusinessDaysElapsed,
  getSLAStatus,
  validateFieldValues,
  formatRequestSummary,
  checkForEscalation,
};
