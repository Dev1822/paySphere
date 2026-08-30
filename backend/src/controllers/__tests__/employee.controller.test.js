const { deleteEmployee, updateEmployee, importEmployees } = require("../employee.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
jest.mock("../../services/audit.service", () => ({ createAuditLog: jest.fn() }));

// Mock csv-parse so we can assert on options passed
jest.mock("csv-parse", () => ({ parse: jest.fn() }));

// deleteEmployee now refuses to destroy an employee with a settled F&F, the
// same protection #345 added for paid payroll (#462). Stubbed so the employee
// unit tests stay free of the settlement collection; the guard has its own
// coverage below and in settlement.controller.test.js.
jest.mock("../../models/settlement.model", () => ({
  exists: jest.fn().mockResolvedValue(null),
}));
const { parse: mockParse } = require("csv-parse");

// The company. A different value from the user id on purpose: since #613 the
// scope is the tenant, not the account that created the row.
const TENANT = "507f1f77bcf86cd799439098";
const OTHER_TENANT = "507f1f77bcf86cd799439097";

describe("Employee Controller - deleteEmployee (#345)", () => {
  let req, res, mockSession;

  beforeEach(() => {
    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      userId: "507f1f77bcf86cd799439012",
      tenantId: TENANT,
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

  test("should return 404 if employee is not found", async () => {
    Employee.findById.mockResolvedValue(null);

    await deleteEmployee(req, res);

    expect(Employee.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Employee not found" });
  });

  test("should return 403 if user is not authorized to delete employee", async () => {
    const mockEmployee = {
      _id: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439099",
      tenantId: OTHER_TENANT,
      fullName: "John Doe",
      role: "Developer",
    };
    Employee.findById.mockResolvedValue(mockEmployee);

    await deleteEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Not authorized to delete this employee",
    });
  });

  test("should soft delete employee by setting deletedAt and isActive = false", async () => {
    const mockEmployee = {
      _id: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
      tenantId: TENANT,
      fullName: "John Doe",
      role: "Developer",
      isActive: true,
      deletedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Employee.findById.mockResolvedValue(mockEmployee);

    await deleteEmployee(req, res);

    expect(mockEmployee.save).toHaveBeenCalled();
    expect(mockEmployee.isActive).toBe(false);
    expect(mockEmployee.deletedAt).toBeInstanceOf(Date);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Employee deleted successfully",
      employee: mockEmployee,
    });
  });
});

// ---- Direct csv-parse BOM tests (real parser) ----
describe("csv-parse BOM behavior", () => {
  test("bom: true strips UTF-8 BOM from header names", async () => {
    const { parse } = jest.requireActual("csv-parse");
    const csv = "\ufefffullName,role,monthlySalary\nJohn Doe,Developer,50000";

    const records = await new Promise((resolve, reject) => {
      parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }, (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });

    expect(Object.keys(records[0])[0]).toBe("fullName");
    expect(records[0].fullName).toBe("John Doe");
  });

  test("bom: true works with CSV that has no BOM (no regression)", async () => {
    const { parse } = jest.requireActual("csv-parse");
    const csv = "fullName,role,monthlySalary\nJohn Doe,Developer,50000";

    const records = await new Promise((resolve, reject) => {
      parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }, (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });

    expect(Object.keys(records[0])[0]).toBe("fullName");
    expect(records[0].fullName).toBe("John Doe");
  });
});

// ---- importEmployees tests ----
describe("Employee Controller - importEmployees", () => {
  let req, res, next, mockSession;

  beforeEach(() => {
    req = {
      userId: "user123",
      tenantId: TENANT,
      file: { buffer: Buffer.from("dummy"), originalname: "employees.csv" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
    User.findById.mockResolvedValue({ _id: "user123", companyName: "Acme Corp" });
    Employee.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    Employee.insertMany.mockResolvedValue([{ _id: "emp1" }]);

    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "John Doe", role: "Developer", monthlySalary: "50000", overtimeRate: "100" },
      ]);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should pass bom: true option to csv-parse", async () => {
    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockParse).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ bom: true }),
      expect.any(Function),
    );
  });

  test("should import employees successfully from CSV", async () => {
    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Employee import completed" }),
    );
  });

  test("should return 400 when no CSV file is uploaded", async () => {
    req.file = undefined;

    await importEmployees(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No CSV file uploaded" });
  });

  test("should return 404 when user not found", async () => {
    User.findById.mockResolvedValue(null);

    await importEmployees(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  test("should skip rows with missing required fields", async () => {
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "", role: "Dev", monthlySalary: "50000", overtimeRate: "100" },
        { fullName: "Jane", role: "", monthlySalary: "60000", overtimeRate: "50" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        skipped: expect.any(Number),
        errors: expect.arrayContaining([
          expect.objectContaining({ reason: "Full name is required" }),
          expect.objectContaining({ reason: "Role is required" }),
        ]),
      }),
    );
  });

  test("should skip duplicate employees (same name and role)", async () => {
    Employee.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { fullName: "John Doe", role: "Developer" },
      ]),
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ reason: expect.stringMatching(/duplicate/i) }),
        ]),
      }),
    );
  });

  test("should return actual inserted count when all inserts succeed (#378)", async () => {
    Employee.insertMany.mockResolvedValue([
      { _id: "e1", fullName: "Alice" },
      { _id: "e2", fullName: "Bob" },
    ]);
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "Alice", role: "Dev", monthlySalary: "50000", overtimeRate: "200" },
        { fullName: "Bob", role: "QA", monthlySalary: "40000", overtimeRate: "150" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.imported).toBe(2);
    expect(response.skipped).toBe(0);
  });

  test("should return 0 imported when insertMany fails with duplicate key error and no docs inserted (#378)", async () => {
    const insertError = new Error("E11000 duplicate key error");
    insertError.code = 11000;
    insertError.insertedDocs = [];
    insertError.writeErrors = [{}, {}]; // mock 2 duplicate key errors
    Employee.insertMany.mockRejectedValue(insertError);
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "Alice", role: "Dev", monthlySalary: "50000", overtimeRate: "200" },
        { fullName: "Bob", role: "QA", monthlySalary: "40000", overtimeRate: "150" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.imported).toBe(0);
    expect(response.skipped).toBe(2);
  });

  test("should return partial count when insertMany partially succeeds with duplicate key error (#378)", async () => {
    const insertError = new Error("E11000 duplicate key error");
    insertError.code = 11000;
    insertError.insertedDocs = [{ _id: "e1", fullName: "Alice" }];
    insertError.writeErrors = [{}, {}]; // mock 2 duplicate key errors
    Employee.insertMany.mockRejectedValue(insertError);
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "Alice", role: "Dev", monthlySalary: "50000", overtimeRate: "200" },
        { fullName: "Bob", role: "QA", monthlySalary: "40000", overtimeRate: "150" },
        { fullName: "Charlie", role: "PM", monthlySalary: "60000", overtimeRate: "300" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.imported).toBe(1);
    expect(response.skipped).toBe(2);
  });

  test("should propagate non-duplicate-key errors to next() (#378)", async () => {
    const dbError = new Error("Connection lost");
    dbError.code = 999;
    Employee.insertMany.mockRejectedValue(dbError);
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "Alice", role: "Dev", monthlySalary: "50000", overtimeRate: "200" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("Employee Controller - updateEmployee", () => {
  let req, res, next, employeeDoc;

  beforeEach(() => {
    employeeDoc = {
      _id: "emp1",
      __v: 2,
      createdBy: { toString: () => "user123" },
      tenantId: { toString: () => TENANT },
      fullName: "Old Name",
      monthlySalary: 30000,
      overtimeRate: 100,
      save: jest.fn().mockResolvedValue(true),
    };
    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      userId: "user123",
      tenantId: TENANT,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    Employee.findById.mockResolvedValue(employeeDoc);
  });

  test("should reject non-finite monthlySalary (e.g. Infinity)", async () => {
    req.body = { monthlySalary: Infinity };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });

  test("should reject non-finite overtimeRate (e.g. Infinity)", async () => {
    req.body = { overtimeRate: Infinity };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });

  test("should accept a valid finite monthlySalary", async () => {
    req.body = {
      monthlySalary: 35000,
      version: 2,
    };
    await updateEmployee(req, res, next);

    expect(employeeDoc.monthlySalary).toBe(35000);
    expect(employeeDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
  test("should reject a stale employee version with 409", async () => {
    req.body = {
      monthlySalary: 35000,
      version: 1,
    };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });

  test("should reject an update when the version is missing", async () => {
    req.body = {
      monthlySalary: 35000,
    };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });
describe("Employee Controller - updateEmployee name propagation to PayrollUpdate (#253)", () => {
  let req, res, next, employeeDoc;

  beforeEach(() => {
    employeeDoc = {
      _id: "507f1f77bcf86cd799439011",
      createdBy: { toString: () => "user123" },
      tenantId: { toString: () => TENANT },
      fullName: "Original Name",
      role: "Engineer",
      monthlySalary: 30000,
      overtimeRate: 100,
      save: jest.fn().mockResolvedValue(true),
    };

    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      userId: "user123",
      tenantId: TENANT,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    Employee.findById.mockResolvedValue(employeeDoc);
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 3 });
  });

  test("should propagate fullName change to finalized PayrollUpdate records", async () => {
    req.body = { fullName: "New Name" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.fullName).toBe("New Name");
    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { employeeId: "507f1f77bcf86cd799439011", tenantId: TENANT, status: "finalized" },
      { $set: { employeeName: "New Name" } }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is unchanged", async () => {
    req.body = { fullName: "Original Name" };

    await updateEmployee(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is not provided (other field update)", async () => {
    req.body = { monthlySalary: 50000 };

    await updateEmployee(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is empty string (validation fails first)", async () => {
    req.body = { fullName: "" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.save).not.toHaveBeenCalled();
    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("should still propagate when only name changes alongside other fields", async () => {
    req.body = { fullName: "New Name", monthlySalary: 50000, role: "Senior Engineer" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.fullName).toBe("New Name");
    expect(employeeDoc.role).toBe("Senior Engineer");
    expect(employeeDoc.monthlySalary).toBe(50000);
    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { employeeId: "507f1f77bcf86cd799439011", tenantId: TENANT, status: "finalized" },
      { $set: { employeeName: "New Name" } }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
