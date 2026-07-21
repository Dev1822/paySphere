const {
  isNonEmptyString,
  isValidEmail,
  isPositiveNumber,
  isNonNegativeNumber,
  sanitizeString,
} = require("../validators");
const { calculateNetSalary } = require("../salaryCalculator");

describe("Validation Utility Unit Tests", () => {
  describe("isNonEmptyString", () => {
    test("should return true for valid non-empty strings", () => {
      expect(isNonEmptyString("John Doe")).toBe(true);
      expect(isNonEmptyString("  Jane  ")).toBe(true);
    });

    test("should return false for empty strings, whitespace, objects, arrays, and numbers", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString({ $gt: "" })).toBe(false); // NoSQL injection vector
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    test("should return true for valid email strings", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("test.user@domain.co")).toBe(true);
    });

    test("should return false for invalid emails or non-string inputs", () => {
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail({ $gt: "" })).toBe(false); // NoSQL injection vector
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("isPositiveNumber", () => {
    test("should return true for positive finite numbers", () => {
      expect(isPositiveNumber(100)).toBe(true);
      expect(isPositiveNumber(0.01)).toBe(true);
    });

    test("should return false for zero, negative numbers, NaN, Infinity, and strings", () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-10)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber(Infinity)).toBe(false);
      expect(isPositiveNumber("100")).toBe(false);
    });
  });

  describe("isNonNegativeNumber", () => {
    test("should return true for zero and positive finite numbers", () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(50)).toBe(true);
    });

    test("should return false for negative numbers, NaN, Infinity, and non-numbers", () => {
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber(NaN)).toBe(false);
      expect(isNonNegativeNumber(Infinity)).toBe(false);
      expect(isNonNegativeNumber("0")).toBe(false);
    });
  });
});

describe("salaryCalculator Robustness Tests", () => {
  test("should handle NaN, negative numbers, and undefined inputs safely without returning NaN", () => {
    const employee = { monthlySalary: NaN, overtimeRate: -50 };
    const user = { defaultDailyRate: "abc", defaultOvertimeRate: NaN };
    const adjustments = { leaveDays: -5, overtimeHours: NaN, bonus: "invalid", deductions: null };

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.baseSalary).toBe(0);
    expect(result.leaveDeduction).toBe(0);
    expect(result.overtimePay).toBe(0);
    expect(result.netSalary).toBe(0);
    expect(isNaN(result.netSalary)).toBe(false);
  });
});
