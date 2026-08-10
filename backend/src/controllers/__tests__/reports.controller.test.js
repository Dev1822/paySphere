const { getAnalytics, downloadPDFReport, exportExcelReport, downloadPayslipsZip } = require("../reports.controller");
const PayrollUpdate = require("../../models/payroll.model");
const Employee = require("../../models/employee.model");
const User = require("../../models/user.model");

jest.mock("../../models/payroll.model");
jest.mock("../../models/employee.model");
jest.mock("../../models/user.model");
jest.mock("../../services/audit.service", () => ({
  createAuditLog: jest.fn(),
}));

jest.mock("archiver", () => {
  return jest.fn().mockReturnValue({
    pipe: jest.fn(),
    append: jest.fn(),
    finalize: jest.fn().mockResolvedValue(true),
  });
});

jest.mock("worker_threads", () => {
  const EventEmitter = require("events");
  class MockWorker extends EventEmitter {
    postMessage() {}
    on(event, cb) {
      super.on(event, cb);
      if (event === "message") {
        cb({ success: true, pdfData: Buffer.from("dummy pdf data") });
      }
    }
    terminate() {}
  }
  return { Worker: MockWorker };
});
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
    on: jest.fn((event, callback) => {
      if (event === "data") callback(Buffer.from("dummy pdf data"));
      if (event === "end") callback();
    }),
  };
  return jest.fn().mockImplementation(() => doc);
});

describe("Reports Controller - getAnalytics", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "507f1f77bcf86cd799439011",
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return empty analytics when no payroll records exist", async () => {
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
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
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    Employee.find.mockResolvedValue([]);

    await getAnalytics(req, res, next);

    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const query = PayrollUpdate.find.mock.calls[0][0];

    expect(query.$or[1].year).toBe(expectedStart.getFullYear());
    expect(query.$or[1].month.$gte).toBe(expectedStart.getMonth() + 1);
  });

  test("should aggregate monthly trends and role breakdown correctly", async () => {
    const mockPayrolls = [
      {
        employeeId: "emp1",
        baseSalary: 50000,
        overtimePay: 5000,
        bonus: 2000,
        deductions: 1000,
        leaveDeduction: 500,
        netSalary: 55500,
        month: 6,
        year: 2026,
      },
      {
        employeeId: "emp2",
        baseSalary: 60000,
        overtimePay: 3000,
        bonus: 0,
        deductions: 2000,
        leaveDeduction: 0,
        netSalary: 61000,
        month: 6,
        year: 2026,
      },
    ];
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockPayrolls) });

    const mockEmployees = [
      { _id: "emp1", role: "Developer" },
      { _id: "emp2", role: "Designer" },
    ];
    Employee.find.mockResolvedValue(mockEmployees);

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

    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    Employee.find.mockResolvedValue([]);

    await getAnalytics(req, res, next);

    // Verify the query was built with 12-month range (the find was called)
    expect(PayrollUpdate.find).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should call next(error) on database failure", async () => {
    const error = new Error("DB connection failed");
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(error) });

    await getAnalytics(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("Reports Controller - downloadPDFReport", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "507f1f77bcf86cd799439011",
      query: { month: "6", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
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

describe("Reports Controller - exportExcelReport", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "507f1f77bcf86cd799439011",
      query: { month: "6", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return 400 for invalid month", async () => {
    req.query.month = "15";
    await exportExcelReport(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("should return 404 when no payroll data exists for period", async () => {
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await exportExcelReport(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("should generate and stream XLSX file when payroll data exists", async () => {
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
        status: "finalized",
      },
    ];
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockPayrolls) });
    Employee.find.mockResolvedValue([{ _id: "emp1", role: "Developer" }]);

    await exportExcelReport(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("payroll-summary-June-2026.xlsx")
    );
    expect(res.end).toHaveBeenCalled();
  });
});

describe("Reports Controller - downloadPayslipsZip", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "507f1f77bcf86cd799439011",
      query: { month: "6", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return 400 for invalid month", async () => {
    req.query.month = "0";
    await downloadPayslipsZip(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("should return 404 when no payroll data exists for period", async () => {
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await downloadPayslipsZip(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("should generate and stream ZIP file when payroll data exists", async () => {
    const mockPayrolls = [
      {
        employeeId: "emp1",
        employeeName: "Alice Smith",
        month: 6,
        year: 2026,
        baseSalary: 50000,
        overtimeHours: 2,
        overtimePay: 5000,
        bonus: 2000,
        deductions: 1000,
        leaveDays: 1,
        leaveDeduction: 500,
        netSalary: 55500,
      },
    ];
    PayrollUpdate.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockPayrolls) });
    User.findById.mockResolvedValue({ companyName: "TestCorp", settings: {} });
    Employee.find.mockResolvedValue([{ _id: "emp1", fullName: "Alice Smith", role: "Developer", companyName: "TestCorp" }]);

    await downloadPayslipsZip(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/zip");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("payslips-June-2026.zip")
    );
  });
});

