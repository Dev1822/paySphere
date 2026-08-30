const { submitPayrollForReview, getPayrollSummary, sendAllPayslipsEmailHandler } = require("../payroll.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../utils/lockManager", () => ({
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../models/exchangeRate.model", () => ({
  findOne: jest.fn(() => ({ sort: jest.fn().mockResolvedValue(null) })),
}));

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
// Read once per employee in a run, to bundle anything owed from a backdated
// salary revision (#931). Mocked as a factory rather than automocked so the
// query never reaches Mongoose: unmocked, it buffers against a database this
// suite never connects to and every test in the file times out (#950).
jest.mock('../../models/arrearsLedger.model', () => ({
  // Plain functions rather than jest.fn: this suite calls jest.resetAllMocks()
  // in every beforeEach, which strips implementations off factory mocks.
  find: () => ({ sort: () => ({ lean: async () => [] }) }),
  updateMany: async () => ({ modifiedCount: 0 }),
  insertMany: async () => [],
}));
// Expense claims are read for every employee in a run since #719. Same reason
// as the mock above: unmocked it buffers and the whole suite times out.
jest.mock('../../models/expenseClaim.model', () => ({
  find: () => ({ populate: () => ({ lean: async () => [] }) }),
  bulkWrite: async () => ({}),
}));
// submitPayrollForReview now consults the attendance ledger (#459). Stubbed so
// the payroll unit tests stay free of the attendance collection; the ledger's
// own behaviour is covered in attendance.controller.test.js.
jest.mock("../../models/attendance.model", () => ({
  find: jest.fn(() => ({ select: jest.fn().mockResolvedValue([]) })),
}));

// submitPayrollForReview now recovers loan instalments (#460). Stubbed so the
// payroll unit tests stay free of the loan collection; recovery behaviour is
// covered in payroll.loans.test.js.
jest.mock("../../models/loan.model", () => ({
  find: jest.fn().mockResolvedValue([]),
  updateOne: jest.fn().mockResolvedValue({}),
}));

// submitPayrollForReview now snapshots the salary component breakdown (#461).
// Stubbed so the payroll unit tests stay free of the structure collection;
// resolution is covered in salaryStructure.test.js.
jest.mock("../../models/salaryStructure.model", () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));
jest.mock("../../services/audit.service", () => ({
  createAuditLog: jest.fn(),
}));
jest.mock("../../services/email.service", () => ({
  sendPayslipEmail: jest.fn().mockResolvedValue(undefined),
}));

// Helper to construct query mock supporting both direct await and .sort() chaining
const createQueryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(data),
  then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  catch: (reject) => Promise.resolve(data).catch(reject),
});

describe("Payroll Controller - submitPayrollForReview parseTagValue & Transactions Unit Tests (#106)", () => {
  let req, res, mockSession;

  beforeEach(() => {
    jest.resetAllMocks();

    req = {
      userId: "507f1f77bcf86cd799439011",
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should default unparseable tags like 'deduction' without a number to 0 instead of NaN", async () => {
    const mockEmployee = {
      _id: "507f1f77bcf86cd799439011",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
      isActive: true,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.bulkWrite.mockResolvedValue({});
    PayrollUpdate.find
      .mockImplementationOnce(() => createQueryMock([])) // Guard query — no existing paid records
      .mockImplementationOnce(() => createQueryMock([{ _id: "payroll1", employeeId: "emp1" }])); // Phase 3 query

    req.body = {
      activities: [
        {
          employeeId: "507f1f77bcf86cd799439011",
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

    await submitPayrollForReview(req, res);

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
test('stores calculation inputs in the payroll snapshot so later employee changes cannot alter the calculation', async () => {
  const mockEmployee = {
    _id: "507f1f77bcf86cd799439011",
    fullName: "Alice Smith",
    email: "alice@example.com",
    role: "Developer",
    companyName: "PaySphere",
    language: "en",
    monthlySalary: 50000,
    overtimeRate: 200,
    isActive: true,
  };

  Employee.find.mockResolvedValue([mockEmployee]);
  User.findById.mockResolvedValue({
    defaultDailyRate: 1000,
    defaultOvertimeRate: 200,
  });

  PayrollUpdate.bulkWrite.mockResolvedValue({});
  PayrollUpdate.find
    .mockImplementationOnce(() => createQueryMock([]))
    .mockImplementationOnce(() =>
      createQueryMock([{ _id: "payroll1", employeeId: "emp1" }]),
    );

  req.body = {
    activities: [
      {
        employeeId: mockEmployee._id,
        name: mockEmployee.fullName,
        tags: [{ label: "bonus 500" }],
      },
    ],
    month: 7,
    year: 2026,
  };

  await submitPayrollForReview(req, res);

  const bulkOperations = PayrollUpdate.bulkWrite.mock.calls[0][0];
  const payrollData =
    bulkOperations[0].updateOne.update.$set;

  expect(payrollData.calculationSnapshot.version).toBe("1.0.0");
  expect(payrollData.calculationSnapshot.employee.fullName).toBe(
    "Alice Smith",
  );
  expect(payrollData.calculationSnapshot.inputs.baseSalary).toBe(50000);
  expect(payrollData.calculationSnapshot.inputs.overtimeRate).toBe(200);
  expect(payrollData.calculationSnapshot.inputs.bonus).toBe(500);
  expect(payrollData.calculationSnapshot.finalAmounts.netSalary).toBe(
    payrollData.netSalary,
  );
});
test("should reject payroll approval when employee compensation data is stale", async () => {
  const payrollId = "507f1f77bcf86cd799439011";
  const employeeId = "507f1f77bcf86cd799439012";

  PayrollUpdate.find.mockResolvedValue([
    {
      _id: payrollId,
      employeeId,
      calculationSnapshot: {
        employee: {
          version: 3,
        },
      },
      status: "PENDING_APPROVAL",
    },
  ]);

  Employee.find.mockResolvedValue([
    {
      _id: employeeId,
      __v: 4,
    },
  ]);

  req.body = {
    payrollIds: [payrollId],
  };

  await approvePayroll(req, res, next);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message:
        "Employee compensation data changed after this payroll was calculated. Review and recalculate the affected payroll before approving it.",
    }),
  );
});
  test("should correctly classify tags containing 'days' or 'hrs' such as 'Overtime 2 days' and 'Deduction 3 days' (#377)", async () => {
    const mockEmployee = {
      _id: "507f1f77bcf86cd799439011",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
      isActive: true,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 1000, defaultOvertimeRate: 200 });

    PayrollUpdate.bulkWrite.mockResolvedValue({});
    PayrollUpdate.find
      .mockImplementationOnce(() => createQueryMock([]))
      .mockImplementationOnce(() => createQueryMock([{ _id: "payroll1", employeeId: "emp1" }]));

    req.body = {
      activities: [
        {
          employeeId: "507f1f77bcf86cd799439011",
          name: "Alice Smith",
          tags: [
            { label: "Overtime 2 days" }, // should be overtime (2 hrs/units), NOT leaveDays
            { label: "Deduction 300" },   // should be deduction
            { label: "Leave 1 day" },     // should be leaveDays
          ],
        },
      ],
      month: 7,
      year: 2026,
    };

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    const result = jsonCall.results[0];

    expect(result.overtimeHours).toBe(2);
    expect(result.leaveDays).toBe(1);
    expect(result.deductions).toBe(300);
  });
});

describe("submitPayrollForReview month/year validation tests (#79)", () => {
  let req, res;

  beforeEach(() => {
    jest.resetAllMocks();
    req = {
      userId: "507f1f77bcf86cd799439011",
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

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is a float (5.5)", async () => {
    req.body.month = 5.5;

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is 0 (not silently fall back to current month)", async () => {
    req.body.month = 0;

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is negative", async () => {
    req.body.month = -5;

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if year is out of range (1999)", async () => {
    req.body.year = 1999;

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });

  test("should return 400 if year is a float (2024.5)", async () => {
    req.body.year = 2024.5;

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });
});

describe("submitPayrollForReview paid-record guard (#251)", () => {
  let req, res, mockEmployees, mockUserSettings, mockSession;

  beforeEach(() => {
    jest.resetAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    mockEmployees = [
      {
        _id: "emp1",
        fullName: "Alice Smith",
        monthlySalary: 50000,
        overtimeRate: 200,
        isActive: true,
      },
      {
        _id: "emp2",
        fullName: "Bob Jones",
        monthlySalary: 60000,
        overtimeRate: 250,
        isActive: true,
      },
    ];

    mockUserSettings = { defaultDailyRate: 0, defaultOvertimeRate: 0 };

    req = {
      userId: "user123",
      body: {
        activities: [
          {
            employeeId: "emp1",
            name: "Alice Smith",
            tags: [],
          },
          {
            employeeId: "emp2",
            name: "Bob Jones",
            tags: [],
          },
        ],
        month: 7,
        year: 2026,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    Employee.find.mockResolvedValue(mockEmployees);
    User.findById.mockResolvedValue(mockUserSettings);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return 409 when paid payroll records exist for the same month/year", async () => {
    PayrollUpdate.find.mockImplementationOnce(() =>
      createQueryMock([
        { employeeName: "Alice Smith", status: "paid" },
        { employeeName: "Bob Jones", status: "paid" },
      ])
    );

    await submitPayrollForReview(req, res);

    // 409 rather than 400 since #458: the request is well formed, it is the
    // record's state that forbids it — same code the transition table returns.
    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toContain("already paid for: Alice Smith, Bob Jones");
    expect(payload.paidEmployees).toEqual(["Alice Smith", "Bob Jones"]);
    expect(PayrollUpdate.bulkWrite).not.toHaveBeenCalled();
  });

  test("should return 409 when an approved run already exists — a maker cannot rewrite figures after sign-off (#458)", async () => {
    PayrollUpdate.find.mockImplementationOnce(() =>
      createQueryMock([{ employeeName: "Alice Smith", status: "approved" }])
    );

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toContain("already approved for: Alice Smith");
    expect(payload.approvedEmployees).toEqual(["Alice Smith"]);
    expect(PayrollUpdate.bulkWrite).not.toHaveBeenCalled();
  });

  test("should succeed when some employees have no payroll records yet", async () => {
    PayrollUpdate.find
      .mockImplementationOnce(() => createQueryMock([])) // Guard — no paid records
      .mockImplementationOnce(() =>
        createQueryMock([
          { _id: "payroll1", employeeId: "emp1" },
          { _id: "payroll2", employeeId: "emp2" },
        ])
      );

    PayrollUpdate.bulkWrite.mockResolvedValue({});

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(2);
  });

  test("should succeed when the period has no approved or paid records yet", async () => {
    PayrollUpdate.find
      .mockImplementationOnce(() => createQueryMock([])) // Guard — nothing locked
      .mockImplementationOnce(() =>
        createQueryMock([
          { _id: "payroll1", employeeId: "emp1" },
          { _id: "payroll2", employeeId: "emp2" },
        ])
      );

    PayrollUpdate.bulkWrite.mockResolvedValue({});

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(2);
  });

  test("submits the run as pending_approval with a submission trail (#458)", async () => {
    PayrollUpdate.find
      .mockImplementationOnce(() => createQueryMock([]))
      .mockImplementationOnce(() =>
        createQueryMock([{ _id: "payroll1", employeeId: "emp1" }])
      );

    PayrollUpdate.bulkWrite.mockResolvedValue({});

    await submitPayrollForReview(req, res);

    const ops = PayrollUpdate.bulkWrite.mock.calls[0][0];
    const written = ops[0].updateOne.update.$set;
    expect(written.status).toBe("pending_approval");
    expect(written.submittedBy).toBe(req.userId);
    expect(written.submittedAt).toBeInstanceOf(Date);
    // A resubmission must not carry a stale verdict forward.
    expect(written.approvedBy).toBeNull();
    expect(written.rejectionReason).toBeNull();
  });

  test("should still validate activity data before paid-record guard", async () => {
    req.body.activities = [];

    await submitPayrollForReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No activities to process",
    });
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });
});

describe("getPayrollSummary floating-point precision unit test (#347)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.resetAllMocks();
    req = {
      userId: "507f1f77bcf86cd799439011",
      // getPayrollSummary asserts its scope with requireTenant now, instead of
      // spreading a possibly-undefined `req.tenantId` into the filter and
      // letting mongoose delete the key (#665). This fixture never set one.
      tenantId: "507f1f77bcf86cd799439012",
      query: { month: "7", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should round totalPayout to 2 decimal places to prevent floating-point precision errors", async () => {
    // Since #458 only approved/paid rows count towards totalPayout, so the
    // fixtures carry an explicit status rather than relying on the old
    // status-blind sum.
    const mockPayrolls = [
      { employeeName: "Alice", netSalary: 1250.55, status: "approved" },
      { employeeName: "Bob", netSalary: 3410.80, status: "paid" },
    ];

    PayrollUpdate.countDocuments.mockResolvedValue(mockPayrolls.length);
    PayrollUpdate.aggregate.mockResolvedValue([
      { totalPayout: 4661.35, payableCount: 2, pendingApprovalTotal: 0, pendingApprovalCount: 0 }
    ]);
    PayrollUpdate.find.mockImplementation(() => createQueryMock(mockPayrolls));

    await getPayrollSummary(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.totalPayout).toBe(4661.35);
    expect(responsePayload.totalPayout).not.toBe(4661.350000000001);
  });
});

describe("sendAllPayslipsEmailHandler — req.body.year undefined guard (#352)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.resetAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should NOT throw TypeError when req.body is undefined and year is in query params", async () => {
    req = {
      userId: "user123",
      body: undefined,
      query: { month: "7", year: "2026" },
    };

    PayrollUpdate.find.mockResolvedValue([]);

    // Must resolve without throwing — pre-fix this would crash with
    // TypeError: Cannot read properties of undefined (reading 'year')
    await expect(sendAllPayslipsEmailHandler(req, res, next)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("should NOT throw TypeError when req.body is null and year is in query params", async () => {
    req = {
      userId: "user123",
      body: null,
      query: { month: "6", year: "2025" },
    };

    PayrollUpdate.find.mockResolvedValue([]);

    await expect(sendAllPayslipsEmailHandler(req, res, next)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("should fall back to current year when req.body is undefined and no query year", async () => {
    req = {
      userId: "user123",
      body: undefined,
      query: { month: "7" }, // no year in query
    };

    PayrollUpdate.find.mockResolvedValue([]);

    await sendAllPayslipsEmailHandler(req, res, next);

    // Should have fallen back to current year, not crashed
    expect(res.status).toHaveBeenCalledWith(404);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg).toHaveProperty("message");
  });

  test("should correctly parse year from req.body when body and year are both present", async () => {
    req = {
      userId: "user123",
      body: { month: 7, year: 2026 },
      query: {},
    };

    PayrollUpdate.find.mockResolvedValue([]);

    await sendAllPayslipsEmailHandler(req, res, next);

    // Valid body — should reach the 404 "no payroll records" path cleanly
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test("should filter by payslipEmailed: false and mark true after sending", async () => {
    req = {
      userId: "user123",
      body: { month: 7, year: 2026 },
      query: {},
    };

    const mockPayroll = {
      _id: "payroll1",
      employeeId: "emp1",
      month: 7,
      year: 2026,
      status: "finalized",
    };
    PayrollUpdate.find.mockResolvedValue([mockPayroll]);

    const mockEmployee = { _id: "emp1", fullName: "Test User", email: "test@example.com" };
    const Employee = require("../../models/employee.model");
    const { sendPayslipEmail } = require("../../services/email.service");
    Employee.find.mockResolvedValue([mockEmployee]);

    await sendAllPayslipsEmailHandler(req, res, next);

    expect(PayrollUpdate.find).toHaveBeenCalledWith(
      expect.objectContaining({ payslipEmailed: false })
    );
    expect(sendPayslipEmail).toHaveBeenCalledWith(mockEmployee, mockPayroll);
    expect(PayrollUpdate.updateOne).toHaveBeenCalledWith(
      { _id: "payroll1" },
      { payslipEmailed: true }
    );
  });
});

describe("submitPayrollForReview — Concurrent Mutex Lock (#1091)", () => {
  const lockManager = require("../../utils/lockManager");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should reject request with 409 Conflict if lock is already held", async () => {
    lockManager.acquireLock.mockResolvedValueOnce(false); // Lock acquisition fails

    const req = {
      tenantId: "tenant123",
      userId: "user123",
      body: {
        activities: [{ employeeId: "emp1", tags: [{ label: "10 hours overtime" }] }],
        month: 8,
        year: 2026,
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await submitPayrollForReview(req, res, jest.fn());

    expect(lockManager.acquireLock).toHaveBeenCalledWith(
      expect.stringContaining("payroll_lock:tenant123:2026:8"),
      300000
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Another payroll process is currently running"),
      })
    );
  });

  test("should acquire and release lock on successful processing", async () => {
    lockManager.acquireLock.mockResolvedValueOnce(true);

    const mockEmployee = { _id: "emp1", fullName: "John Doe", isActive: true, targetCurrency: "USD" };
    Employee.find.mockResolvedValueOnce([mockEmployee]);
    User.findById.mockResolvedValueOnce({ _id: "user123" });

    // Mock count & find stubs
    PayrollUpdate.find.mockResolvedValueOnce([]); // no locked records
    PayrollUpdate.bulkWrite.mockResolvedValueOnce({});
    PayrollUpdate.find.mockResolvedValueOnce([{ _id: "p1", employeeId: "emp1" }]); // return updated

    const req = {
      tenantId: "tenant123",
      userId: "user123",
      body: {
        activities: [{ employeeId: "emp1", tags: [] }],
        month: 8,
        year: 2026,
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await submitPayrollForReview(req, res, jest.fn());

    expect(lockManager.acquireLock).toHaveBeenCalled();
    expect(lockManager.releaseLock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
