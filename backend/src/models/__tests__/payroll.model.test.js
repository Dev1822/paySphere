const mongoose = require("mongoose");
const PayrollUpdate = require("../payroll.model");

/**
 * Regressions for #559.
 *
 * The approval workflow wrote six fields that were never declared on this
 * schema. Neither failure mode is loud: mongoose drops unknown `$set` keys
 * silently, and the `populate` that throws only throws on the one route nobody
 * had a test for. So these assertions go at the compiled schema directly.
 */
const AUDIT_REFS = ["submittedBy", "approvedBy", "rejectedBy"];
const AUDIT_DATES = ["submittedAt", "approvedAt", "rejectedAt"];
describe("Payroll calculation snapshot immutability (#1802)", () => {
  test("requires a calculation snapshot version", () => {
    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      status: "approved",
      calculationSnapshot: {
        employee: {
          fullName: "Ada Lovelace",
        },
        finalAmounts: {
          netSalary: 88000,
        },
      },
    });

    const error = row.validateSync();

    expect(error.errors["calculationSnapshot.version"]).toBeDefined();
  });

  test("stores the calculation version and finalization metadata", () => {
    const finalizedAt = new Date("2026-08-27T10:00:00Z");
    const finalizedBy = new mongoose.Types.ObjectId();

    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      status: "approved",
      calculationSnapshot: {
        version: "1.0.0",
        ruleId: new mongoose.Types.ObjectId(),
        rules: {
          overtime: {
            rateMultiplier: 1,
          },
          leave: {
            maxDays: 31,
          },
          deductions: {
            multiplier: 1,
          },
          bonus: {
            multiplier: 1,
          },
          salary: {
            dailyRateDivisor: null,
          },
        },
        employee: {          fullName: "Ada Lovelace",
          email: "ada@example.com",
        },
        inputs: {
          baseSalary: 90000,
          deductions: 2000,
        },
        finalAmounts: {
          netSalary: 88000,
        },
        finalizedAt,
        finalizedBy,
      },
    });

    expect(row.validateSync()).toBeUndefined();
    expect(row.calculationSnapshot.version).toBe("1.0.0");
    expect(row.calculationSnapshot.ruleId).toBeDefined();
    expect(row.calculationSnapshot.rules.overtime.rateMultiplier).toBe(1);
    expect(row.calculationSnapshot.rules.leave.maxDays).toBe(31);
    expect(row.calculationSnapshot.finalizedAt).toEqual(finalizedAt);    expect(String(row.calculationSnapshot.finalizedBy)).toBe(
      String(finalizedBy),
    );
  });

  test("rejects changing a finalized calculation snapshot through save", () => {
    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      status: "approved",
      calculationSnapshot: {
        version: "1.0.0",
        employee: {
          fullName: "Ada Lovelace",
        },
        finalAmounts: {
          netSalary: 88000,
        },
        finalizedAt: new Date(),
        finalizedBy: new mongoose.Types.ObjectId(),
      },
    });

    row.calculationSnapshot.employee.fullName = "Changed Name";

    const error = row.validateSync();

    expect(error).toBeUndefined();

    return expect(
      new Promise((resolve, reject) => {
        row.save((saveError) => {
          if (saveError) reject(saveError);
          else resolve();
        });
      }),
    ).rejects.toThrow(
      "Finalized payroll calculation snapshot cannot be modified",
    );
  });
});
describe("PayrollUpdate schema — approval trail (#559)", () => {
  test.each(AUDIT_REFS)("%s is an ObjectId reference to User", (field) => {
    const path = PayrollUpdate.schema.path(field);

    expect(path).toBeDefined();
    expect(path.instance).toBe("ObjectId");
    expect(path.options.ref).toBe("User");
  });

  test.each(AUDIT_DATES)("%s is a Date", (field) => {
    const path = PayrollUpdate.schema.path(field);

    expect(path).toBeDefined();
    expect(path.instance).toBe("Date");
  });

  test("rejectionReason is a String capped at the controller's limit", () => {
    const path = PayrollUpdate.schema.path("rejectionReason");

    expect(path).toBeDefined();
    expect(path.instance).toBe("String");
    expect(path.options.maxlength[0]).toBe(500);
  });

  test("submittedBy can be populated — strictPopulate no longer throws", () => {
    // `getPendingApprovals` calls `.populate("submittedBy", "fullName email")`.
    // With the path absent, mongoose ≥6 throws StrictPopulateError and the
    // checker queue answered 500 on every request.
    expect(PayrollUpdate.schema.path("submittedBy").options.ref).toBe("User");
  });

  test("the audit fields survive a round trip through the document", () => {
    const approver = new mongoose.Types.ObjectId();
    const submitter = new mongoose.Types.ObjectId();

    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      // Required since #585. `createdBy` records the actor, `tenantId` scopes
      // the row — a document needs both to validate (#613).
      tenantId: new mongoose.Types.ObjectId(),
      status: "approved",
      submittedBy: submitter,
      submittedAt: new Date("2026-07-31T09:00:00Z"),
      approvedBy: approver,
      approvedAt: new Date("2026-08-01T10:00:00Z"),
    });

    expect(row.validateSync()).toBeUndefined();
    expect(String(row.submittedBy)).toBe(String(submitter));
    expect(String(row.approvedBy)).toBe(String(approver));
    expect(row.approvedAt.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  test("rejects a reason longer than the cap", () => {
    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      status: "rejected",
      rejectionReason: "x".repeat(501),
    });

    const error = row.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.rejectionReason).toBeDefined();
  });

  test("indexes the maker's own view of the queue", () => {
    // Leads with `tenantId` since #613: that is the field the queue filters on,
    // so an index leading with `createdBy` covered nothing the query asked for.
    // `submittedBy` stays, because "what did *I* submit" is genuinely per-actor
    // within a company.
    const indexed = PayrollUpdate.schema
      .indexes()
      .some(
        ([fields]) =>
          fields.tenantId === 1 &&
          fields.submittedBy === 1 &&
          fields.status === 1,
      );

    expect(indexed).toBe(true);
  });

  test("both the actor and the scope are required on every row", () => {
    // #585's codemod stopped writing `createdBy` while leaving it required, so
    // every create() threw before reaching Mongo (#613). Both fields are
    // declared required, and both are written by the controllers.
    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
    });

    const error = row.validateSync();

    expect(error.errors.createdBy).toBeDefined();
    expect(error.errors.tenantId).toBeDefined();
  });

  test("every scoped index leads with the field the queries filter on", () => {
    const scoped = PayrollUpdate.schema
      .indexes()
      .filter(([fields]) => "tenantId" in fields || "createdBy" in fields);

    expect(scoped.length).toBeGreaterThan(0);
    for (const [fields] of scoped) {
      expect(fields.createdBy).toBeUndefined();
    }
  });
});
