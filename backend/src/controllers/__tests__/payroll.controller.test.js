const { finalizePayroll } = require("../payroll.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");

describe("Payroll Controller - finalizePayroll Transactions & Atomicity Unit Tests (#107)", () => {
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

  test("should wrap all database updates in a transaction and commit on success", async () => {
    const mockEmployee = {
      _id: "emp1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.findOneAndUpdate.mockImplementation((query, data, options) => ({
      _id: "payroll1",
      ...data,
    }));

    req.body = {
      activities: [
        {
          employeeId: "emp1",
          name: "Alice Smith",
          tags: [{ label: "bonus 500" }],
        },
      ],
      month: 7,
      year: 2026,
    };

    await finalizePayroll(req, res);

    expect(mongoose.startSession).toHaveBeenCalled();
    expect(mockSession.startTransaction).toHaveBeenCalled();
    expect(PayrollUpdate.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ session: mockSession })
    );
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should abort transaction and perform rollback on database write failure", async () => {
    const mockEmployee = {
      _id: "emp1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.findOneAndUpdate.mockRejectedValue(new Error("Database write error"));

    req.body = {
      activities: [
        {
          employeeId: "emp1",
          name: "Alice Smith",
          tags: [{ label: "bonus 500" }],
        },
      ],
      month: 7,
      year: 2026,
    };

    await finalizePayroll(req, res);

    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Server error during payroll finalization" })
    );
  });
});
