/**
 * @fileoverview Document Vault Utilities — pure computation and validation
 * @description File validation, expiry computation, access control checks,
 * and document metrics for the employee document vault feature.
 */

/**
 * Validate a file against category constraints.
 *
 * @param {object} file — { originalname, size, mimetype }
 * @param {object} category — DocumentCategory document
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFileUpload(file, category) {
  if (!file) return { valid: false, error: 'No file provided' };
  if (!file.originalname) return { valid: false, error: 'File has no name' };

  // Check extension
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext && category.allowedExtensions?.length > 0) {
    if (!category.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File type ".${ext}" is not allowed. Allowed: ${category.allowedExtensions.join(', ')}`,
      };
    }
  }

  // Check file size
  const maxSizeBytes = (category.maxFileSizeMB || 10) * 1024 * 1024;
  if (file.size && file.size > maxSizeBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size ${sizeMB}MB exceeds maximum of ${category.maxFileSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Compute document expiry date from category validity period.
 *
 * @param {Date|string} uploadDate
 * @param {number} validityDays — from category config
 * @returns {Date|null}
 */
function computeExpiryDate(uploadDate, validityDays) {
  if (!validityDays || validityDays <= 0) return null;
  const date = new Date(uploadDate);
  date.setDate(date.getDate() + validityDays);
  return date;
}

/**
 * Check if a document is expired.
 *
 * @param {object} doc — must have expiresAt, status
 * @param {Date|string} [asOf]
 * @returns {{ expired: boolean, daysRemaining: number|null }}
 */
function checkDocumentExpiry(doc, asOf) {
  if (!doc.expiresAt) return { expired: false, daysRemaining: null };
  if (doc.status === 'Archived' || doc.status === 'Deleted') {
    return { expired: false, daysRemaining: null };
  }

  const now = asOf ? new Date(asOf) : new Date();
  const expiresAt = new Date(doc.expiresAt);

  if (now > expiresAt) {
    return { expired: true, daysRemaining: 0 };
  }

  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  return { expired: false, daysRemaining };
}

/**
 * Check if a user has access to a document.
 *
 * @param {object} user — { _id, role? }
 * @param {object} document — EmployeeDocument with sharedWith, employeeId
 * @param {object} category — DocumentCategory with visibility
 * @param {string} action — 'View', 'Download', 'Edit'
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkDocumentAccess(user, document, category, action) {
  if (!user || !document || !category) {
    return { allowed: false, reason: 'Invalid parameters' };
  }

  // Owner always has access
  if (String(document.employeeId) === String(user._id)) {
    return { allowed: true, reason: 'Document owner' };
  }

  // Check category visibility
  switch (category.visibility) {
    case 'Admin':
      if (user.role === 'ADMIN' || user.accountType === 'owner') {
        return { allowed: true, reason: 'Admin access' };
      }
      return { allowed: false, reason: 'Admin-only category' };

    case 'HR':
      if (['ADMIN', 'HR', 'owner'].includes(user.role || user.accountType)) {
        return { allowed: true, reason: 'HR/Admin access' };
      }
      return { allowed: false, reason: 'HR-only category' };

    case 'Manager':
      if (
        ['ADMIN', 'HR', 'MANAGER', 'owner'].includes(
          user.role || user.accountType,
        )
      ) {
        return { allowed: true, reason: 'Manager+ access' };
      }
      return { allowed: false, reason: 'Manager+ category' };

    case 'Employee':
    default:
      break;
  }

  // Check explicit sharing
  if (document.sharedWith && document.sharedWith.length > 0) {
    const share = document.sharedWith.find(
      (s) => String(s.userId) === String(user._id),
    );
    if (share) {
      if (action === 'View')
        return { allowed: true, reason: 'Shared with you' };
      if (
        action === 'Download' &&
        ['Download', 'Edit'].includes(share.permission)
      ) {
        return { allowed: true, reason: 'Shared with download access' };
      }
      if (action === 'Edit' && share.permission === 'Edit') {
        return { allowed: true, reason: 'Shared with edit access' };
      }
      return { allowed: false, reason: 'Insufficient shared permission' };
    }
  }

  // Manager access to direct reports
  if (user.role === 'MANAGER' || user.accountType === 'manager') {
    return { allowed: true, reason: 'Manager access to team documents' };
  }

  return { allowed: false, reason: 'No access granted' };
}

/**
 * Find documents expiring soon.
 *
 * @param {Array} documents
 * @param {number} horizonDays
 * @param {Date|string} [asOf]
 * @returns {Array<{ document, daysRemaining }>}
 */
function findExpiringDocuments(documents, horizonDays, asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + horizonDays);

  const expiring = [];
  for (const doc of documents) {
    if (!doc.expiresAt || doc.status === 'Archived') continue;
    const expiresAt = new Date(doc.expiresAt);
    if (expiresAt >= now && expiresAt <= horizon) {
      const daysRemaining = Math.ceil(
        (expiresAt - now) / (1000 * 60 * 60 * 24),
      );
      expiring.push({ document: doc, daysRemaining });
    }
  }

  return expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Compute document vault metrics for an employee or tenant.
 *
 * @param {Array} documents
 * @param {Array} categories
 * @returns {object}
 */
function computeVaultMetrics(documents, categories) {
  const total = documents.length;
  const active = documents.filter((d) => d.status === 'Active').length;
  const expired = documents.filter((d) => d.status === 'Expired').length;
  const pendingReview = documents.filter(
    (d) => d.reviewStatus === 'Pending',
  ).length;

  const totalSize = documents.reduce((sum, d) => sum + (d.fileSize || 0), 0);

  // By category
  const byCategory = {};
  for (const cat of categories) {
    const catDocs = documents.filter(
      (d) => String(d.categoryId) === String(cat._id),
    );
    byCategory[cat.name] = {
      count: catDocs.length,
      totalSize: catDocs.reduce((sum, d) => sum + (d.fileSize || 0), 0),
    };
  }

  // Recent uploads (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentUploads = documents.filter(
    (d) => d.uploadedAt && new Date(d.uploadedAt) >= thirtyDaysAgo,
  ).length;

  // Most downloaded
  const topDownloaded = [...documents]
    .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
    .slice(0, 5)
    .map((d) => ({
      documentId: d._id,
      title: d.title,
      downloadCount: d.downloadCount || 0,
    }));

  return {
    totalDocuments: total,
    active,
    expired,
    pendingReview,
    totalSizeBytes: totalSize,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
    byCategory,
    recentUploads,
    topDownloaded,
  };
}

/**
 * Generate a document compliance report.
 *
 * @param {Array} documents
 * @param {Array} categories — required categories
 * @param {Array} employees
 * @returns {Array<{ employeeId, employeeName, department, missingRequired }>}
 */
function complianceReport(documents, categories, employees) {
  const requiredCategories = categories.filter((c) => c.isRequired);
  if (requiredCategories.length === 0) return [];

  const report = [];

  for (const emp of employees) {
    const empDocs = documents.filter(
      (d) => String(d.employeeId) === String(emp._id) && d.status === 'Active',
    );

    const missingRequired = requiredCategories.filter((cat) => {
      const hasDoc = empDocs.some(
        (d) => String(d.categoryId) === String(cat._id),
      );
      return !hasDoc;
    });

    if (missingRequired.length > 0) {
      report.push({
        employeeId: emp._id,
        employeeName: emp.fullName || 'Unknown',
        department: emp.department || '',
        missingRequired: missingRequired.map((c) => ({
          categoryId: c._id,
          categoryName: c.name,
        })),
      });
    }
  }

  return report;
}

module.exports = {
  validateFileUpload,
  computeExpiryDate,
  checkDocumentExpiry,
  checkDocumentAccess,
  findExpiringDocuments,
  computeVaultMetrics,
  complianceReport,
};
