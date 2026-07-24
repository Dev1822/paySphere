const { finalizePayroll } = require("../payroll.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");

describe("Payroll Controller - finalizePayroll parseTagValue & Transactions Unit Tests (#106)", () => {
  let req, res, mockSession;

  beforeEach(() => {
    req = {
      userId: "user123",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should default unparseable tags like 'deduction' without a number to 0 instead of NaN", async () => {
    const mockEmployee = {
      _id: "emp1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
      isActive: true,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.bulkWrite.mockResolvedValue({});
    PayrollUpdate.find.mockResolvedValue([
      {
        _id: "payroll1",
        employeeId: "emp1",
      }
    ]);

    req.body = {
      activities: [
        {
          employeeId: "emp1",
          name: "Alice Smith",
          tags: [
            { label: "deduction" }, // unparseable tag value
            { label: "leave" },     // unparseable tag value
            { label: "bonus 500" }, // valid parsed tag value 500
          ],
        },
      ],
      month: 7,
      year: 2026,
    };

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(1);

    const result = jsonCall.results[0];
    expect(result.deductions).toBe(0);
    expect(result.leaveDays).toBe(0);
    expect(result.bonus).toBe(500);
    expect(isNaN(result.netSalary)).toBe(false);
    expect(result.netSalary).toBe(50500);
  });
});

describe("finalizePayroll month/year validation tests (#79)", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: "user123",
      body: {
        activities: [
          {
            employeeId: "emp123",
            name: "John Doe",
            tags: [],
          },
        ],
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test("should return 400 if month is out of range (13)", async () => {
    req.body.month = 13;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is a float (5.5)", async () => {
    req.body.month = 5.5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is 0 (not silently fall back to current month)", async () => {
    req.body.month = 0;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is negative", async () => {
    req.body.month = -5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if year is out of range (1999)", async () => {
    req.body.year = 1999;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });

  test("should return 400 if year is a float (2024.5)", async () => {
    req.body.year = 2024.5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });
});
