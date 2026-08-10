/**
 * Input validation helpers to prevent NoSQL injection, invalid types, NaN, and negative numbers.
 */

// Check if value is a non-empty string (rejects objects, numbers, arrays, empty strings)
const MONTHLY_SALARY_MAX = 100000000;
const DAILY_RATE_MAX = 10000000;
const OVERTIME_RATE_MAX = 1000000;
const MAX_SAFE_PAYROLL = 10000000000;
const FULLNAME_MAX_LENGTH = 100;
const ROLE_MAX_LENGTH = 100;

const isNonEmptyString = (val) => typeof val === "string" && val.trim().length > 0;

// Check valid email format and type
const isValidEmail = (val) => {
  if (typeof val !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(val.trim());
};

// Check valid phone format (basic international and local number support)
const isValidPhone = (val) => {
  if (typeof val !== "string") return false;
  const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;
  return phoneRegex.test(val.trim());
};

// Check valid positive number (rejects NaN, Infinity, strings, <= 0)
const isPositiveNumber = (val) => typeof val === "number" && !isNaN(val) && Number.isFinite(val) && val > 0;

// Check valid non-negative number (rejects NaN, Infinity, strings, < 0)
const isNonNegativeNumber = (val) => typeof val === "number" && !isNaN(val) && Number.isFinite(val) && val >= 0;

// Sanitize string to prevent object injection
const sanitizeString = (val) => (typeof val === "string" ? val.trim() : "");

// Escape regex special characters to prevent ReDoS attacks
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Strip HTML tags to prevent stored XSS
const stripHtml = (val) => {
  if (typeof val !== "string") return "";
  return val.replace(/<[^>]*>/g, "");
};

// Encode HTML entities for defense-in-depth
const encodeHtmlEntities = (val) => {
  if (typeof val !== "string") return "";
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

// Sanitize string input for text fields: strip HTML tags, then trim
const sanitizeText = (val) => {
  if (typeof val !== "string") return "";
  return stripHtml(val).trim();
};

// Check valid Indian GSTIN format (15 characters)
const isValidGSTIN = (val) => {
  if (typeof val !== "string") return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  return gstinRegex.test(val.trim());
};

// Check valid Indian PAN format (10 characters)
const isValidPAN = (val) => {
  if (typeof val !== "string") return false;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
  return panRegex.test(val.trim());
};

// Check valid Indian IFSC code format (11 characters)
const isValidIFSC = (val) => {
  if (typeof val !== "string") return false;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
  return ifscRegex.test(val.trim());
};

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidGSTIN,
  isValidPAN,
  isValidIFSC,
  isPositiveNumber,
  isNonNegativeNumber,
  sanitizeString,
  escapeRegex,
  stripHtml,
  encodeHtmlEntities,
  sanitizeText,
  MONTHLY_SALARY_MAX,
  DAILY_RATE_MAX,
  OVERTIME_RATE_MAX,
  MAX_SAFE_PAYROLL,
  FULLNAME_MAX_LENGTH,
  ROLE_MAX_LENGTH,
};
