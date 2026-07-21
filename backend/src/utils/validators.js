/**
 * Input validation helpers to prevent NoSQL injection, invalid types, NaN, and negative numbers.
 */

// Check if value is a non-empty string (rejects objects, numbers, arrays, empty strings)
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

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isPositiveNumber,
  isNonNegativeNumber,
  sanitizeString,
};
