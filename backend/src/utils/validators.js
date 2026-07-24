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

module.exports = {
  isNonEmptyString,
  isValidEmail,
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
