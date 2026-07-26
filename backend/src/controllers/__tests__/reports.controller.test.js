const { getAnalytics, downloadPDFReport } = require("../reports.controller");
const PayrollUpdate = require("../../models/payroll.model");
const Employee = require("../../models/employee.model");

jest.mock("../../models/payroll.model");
jest.mock("../../models/employee.model");
jest.mock("pdfkit", () => {
  const doc = {
    pipe: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    switchToPage: jest.fn().mockReturnThis(),
    bufferedPageRange: jest.fn().mockReturnValue({ count: 1 }),
    page: { height: 842 },
  };
  return jest.fn().mockImplementation(() => doc);
});

describe("Reports Controller - getAnalytics", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "user123",
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return empty analytics when no payroll records exist", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([]);
    Employee.find.mockResolvedValue([]);

    await getAnalytics(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.summary.totalPayout).toBe(0);
    expect(body.summary.totalRecords).toBe(0);
    expect(body.monthlyTrends).toEqual([]);
    expect(body.roleBreakdown).toEqual([]);
  });

  test("should clamp a negative months query param instead of inverting the date range", async () => {
    req.query.months = "-3";
    PayrollUpdate.aggregate.mockResolvedValue([]);

    await getAnalytics(req, res, next);

    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const matchStage = PayrollUpdate.aggregate.mock.calls[0][0][0];

    expect(matchStage.$match.$or[1].year).toBe(expectedStart.getFullYear());
    expect(matchStage.$match.$or[1].month.$gte).toBe(expectedStart.getMonth() + 1);
  });

  test("should aggregate monthly trends and role breakdown correctly", async () => {
    const monthlyTrends = [
      {
        month: 6, year: 2026, label: "2026-06",
        totalPayout: 116500, totalBase: 110000, totalOvertime: 8000,
        totalBonus: 2000, totalDeductions: 3500, employeeCount: 2,
      },
    ];
    const roleBreakdown = [
      { role: "Designer", totalPayout: 61000, totalBase: 60000, totalOvertime: 3000, employeeCount: 1 },
      { role: "Developer", totalPayout: 55500, totalBase: 50000, totalOvertime: 5000, employeeCount: 1 },
    ];
    const summaryResult = [{
      totalPayout: 116500, totalBase: 110000, totalOvertime: 8000,
      totalBonus: 2000, totalDeductions: 3500, totalRecords: 2,
    }];

    PayrollUpdate.aggregate
      .mockResolvedValueOnce(monthlyTrends)
      .mockResolvedValueOnce(roleBreakdown)
      .mockResolvedValueOnce(summaryResult);

    await getAnalytics(req, res, next);

    const body = res.json.mock.calls[0][0];

    // Summary
    expect(body.summary.totalPayout).toBe(116500);
    expect(body.summary.totalBase).toBe(110000);
    expect(body.summary.totalOvertime).toBe(8000);
    expect(body.summary.totalBonus).toBe(2000);
    expect(body.summary.totalDeductions).toBe(3500);
    expect(body.summary.totalRecords).toBe(2);
    expect(body.summary.monthsCovered).toBe(1);

    // Monthly trends
    expect(body.monthlyTrends).toHaveLength(1);
    expect(body.monthlyTrends[0].label).toBe("2026-06");
    expect(body.monthlyTrends[0].totalPayout).toBe(116500);

    // Role breakdown sorted by payout descending
    expect(body.roleBreakdown).toHaveLength(2);
    expect(body.roleBreakdown[0].role).toBe("Designer");
    expect(body.roleBreakdown[0].totalPayout).toBe(61000);
    expect(body.roleBreakdown[1].role).toBe("Developer");
    expect(body.roleBreakdown[1].totalPayout).toBe(55500);
  });

  test("should cap monthsBack at 12 even if a higher value is passed", async () => {
    req.query.months = "24";

    PayrollUpdate.aggregate.mockResolvedValue([]);

    await getAnalytics(req, res, next);

    expect(PayrollUpdate.aggregate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should call next(error) on database failure", async () => {
    const error = new Error("DB connection failed");
    PayrollUpdate.aggregate.mockRejectedValue(error);

    await getAnalytics(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("Reports Controller - downloadPDFReport", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "user123",
      query: { month: "6", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return 400 for invalid month", async () => {
    req.query.month = "13";

    await downloadPDFReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid month parameter" });
  });

  test("should return 400 for invalid year", async () => {
    req.query.year = "1999";

    await downloadPDFReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid year parameter" });
  });

  test("should return 400 for non-numeric month", async () => {
    req.query.month = "abc";

    await downloadPDFReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid month parameter" });
  });

  test("should return 404 when no payroll data exists for the period", async () => {
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await downloadPDFReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "No payroll data found for the selected period.",
    });
  });

  test("should generate and stream a PDF when payroll data exists", async () => {
    const mockPayrolls = [
      {
        employeeId: "emp1",
        employeeName: "Alice Smith",
        baseSalary: 50000,
        overtimePay: 5000,
        bonus: 2000,
        deductions: 1000,
        leaveDeduction: 500,
        leaveDays: 1,
        netSalary: 55500,
      },
    ];
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockPayrolls) });
    Employee.find.mockResolvedValue([
      { _id: "emp1", role: "Developer", companyName: "TestCorp" },
    ]);

    await downloadPDFReport(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("payroll-report-June-2026.pdf"),
    );
  });

  test("should call next(error) on database failure", async () => {
    const error = new Error("DB failure");
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(error) });

    await downloadPDFReport(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test("should default to current month/year when no query params provided", async () => {
    req.query = {};
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await downloadPDFReport(req, res, next);

    // Should not return 400 (invalid params) — should proceed to 404 (no data)
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
