const { finalizePayroll } = require("../payroll.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");

describe("Payroll Controller - finalizePayroll Unit Tests (#106)", () => {
  let req, res;

  beforeEach(() => {
    req = {
      userId: "user123",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test("should default unparseable tags like 'deduction' without a number to 0 instead of NaN", async () => {
    const mockEmployee = {
      _id: "emp1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.findOneAndUpdate.mockImplementation((query, data) => ({
      _id: "payroll1",
      ...data,
    }));

    // Activity tag has no numbers in label "deduction" or "leave"
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
    expect(result.netSalary).toBe(50500); // 50000 + 500
  });
});
