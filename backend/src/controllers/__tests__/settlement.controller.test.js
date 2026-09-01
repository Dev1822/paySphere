const mongoose = require('mongoose');
const {
  previewSettlement,
  initiateExit,
  createSettlement,
  updateSettlement,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  markSettlementPaid,
  cancelSettlement,
  getSettlements,
  getSettlementById,
} = require('../settlement.controller');

const Settlement = require('../../models/settlement.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const User = require('../../models/user.model');
const eventBus = require('../../services/event.service');
const {
  EMPLOYMENT_STATUS,
  SETTLEMENT_STATUS,
} = require('../../config/employment');

jest.mock('../../models/settlement.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
jest.mock('../../models/exitClearance.model', () => ({
  findOne: jest.fn().mockResolvedValue(null),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../models/position.model', () => ({
  updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));

const cacheService = require('../../services/cache.service');

const OWNER = '507f1f77bcf86cd799439011';
// The company. A different id from OWNER on purpose: since #613 the scope is
// the tenant, not the account that created the row.
const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';
const SETTLEMENT_ID = '707f1f77bcf86cd7994390b1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const selectMock = (data) => ({ select: jest.fn().mockResolvedValue(data) });

const listMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(data),
});

const employeeDoc = (overrides = {}) => ({
  _id: oid(EMP_A),
  fullName: 'Alice Smith',
  monthlySalary: 26000,
  createdBy: oid(OWNER),
  tenantId: oid(TENANT),
  joiningDate: new Date('2018-01-01'),
  employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
  isActive: true,
  ...overrides,
});

const settlementDoc = (overrides = {}) => ({
  _id: oid(SETTLEMENT_ID),
  employeeId: oid(EMP_A),
  employeeName: 'Alice Smith',
  createdBy: oid(OWNER),
  tenantId: oid(TENANT),
  lastWorkingDay: new Date('2026-07-15'),
  status: SETTLEMENT_STATUS.DRAFT,
  earnings: { encashableDays: 5, bonus: 0, other: 0 },
  deductions: { advanceRecovery: 0, assetRecovery: 0, other: 0 },
  grossEarnings: 13000,
  totalDeductions: 0,
  netSettlement: 13000,
  negativeOverride: false,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Employee.findOne.mockResolvedValue(employeeDoc());
  Employee.updateOne.mockResolvedValue({});
  User.findById.mockImplementation(() => selectMock({ settings: {} }));
  Settlement.findOne.mockResolvedValue(null);
  Settlement.countDocuments.mockResolvedValue(0);
  Settlement.find.mockImplementation(() => listMock([]));
  Settlement.create.mockImplementation((doc) =>
    Promise.resolve({ _id: oid(SETTLEMENT_ID), ...doc }),
  );
  PayrollUpdate.countDocuments.mockResolvedValue(0);
});

describe('previewSettlement — writes nothing (#462)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      query: { employeeId: EMP_A, lastWorkingDay: '2026-07-15' },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('computes a statement without persisting', async () => {
    await previewSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Settlement.create).not.toHaveBeenCalled();
    expect(Employee.updateOne).not.toHaveBeenCalled();

    const payload = res.json.mock.calls[0][0];
    expect(payload.settlement.earnings.proratedSalary).toBeGreaterThan(0);
    expect(payload.settlement.earnings.gratuity).toBeGreaterThan(0);
  });

  test('scopes the employee lookup by tenant', async () => {
    await previewSettlement(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      tenantId: TENANT,
    });
  });

  test("another company's employee is a 404", async () => {
    Employee.findOne.mockResolvedValue(null);

    await previewSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('requires a valid last working day', async () => {
    req.query.lastWorkingDay = 'nonsense';

    await previewSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('surfaces validation without blocking — preview never refuses', async () => {
    req.query.assetRecovery = '500000';

    await previewSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].validation.ok).toBe(false);
  });
});

describe('initiateExit (#462)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      body: { employeeId: EMP_A, lastWorkingDay: '2026-07-15' },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('moves the employee onto notice but keeps them payable', async () => {
    // Excluding them the moment they resign is exactly what made the final
    // month unpayable.
    await initiateExit(req, res, next);

    const update = Employee.updateOne.mock.calls[0][1].$set;
    expect(update.employmentStatus).toBe(EMPLOYMENT_STATUS.NOTICE_PERIOD);
    expect(update.isActive).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('records the exit details', async () => {
    req.body.exitType = 'termination';
    req.body.noticePeriodDays = 60;

    await initiateExit(req, res, next);

    const update = Employee.updateOne.mock.calls[0][1].$set;
    expect(update.exitDetails.exitType).toBe('termination');
    expect(update.exitDetails.noticePeriodDays).toBe(60);
    expect(update.exitDetails.lastWorkingDay).toBeInstanceOf(Date);
  });

  test('rejects a last working day before the joining date', async () => {
    req.body.lastWorkingDay = '2010-01-01';

    await initiateExit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.updateOne).not.toHaveBeenCalled();
  });

  test('refuses to re-exit someone who has already left', async () => {
    Employee.findOne.mockResolvedValue(
      employeeDoc({ employmentStatus: EMPLOYMENT_STATUS.EXITED }),
    );

    await initiateExit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Employee.updateOne).not.toHaveBeenCalled();
  });

  test('requires a valid last working day', async () => {
    req.body.lastWorkingDay = null;

    await initiateExit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('emits an exit audit event', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');

    await initiateExit(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([, payload]) => payload && payload.action === 'EMPLOYEE_EXIT_INITIATED',
    );
    expect(auditCall).toBeDefined();
    emitSpy.mockRestore();
  });

  test('scopes the update by tenant', async () => {
    await initiateExit(req, res, next);

    expect(Employee.updateOne.mock.calls[0][0].tenantId).toBe(TENANT);
  });
});

describe('createSettlement (#462)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      body: {
        employeeId: EMP_A,
        lastWorkingDay: '2026-07-15',
        unusedLeaveDays: 8,
      },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('persists a draft with the computed figures and explanations', async () => {
    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);

    const created = Settlement.create.mock.calls[0][0];
    expect(created.status).toBe(SETTLEMENT_STATUS.DRAFT);
    expect(created.earnings.proratedSalary).toBeGreaterThan(0);
    expect(created.explanations.gratuity).toBeTruthy();
    // The policy is frozen so the statement survives a later policy change.
    expect(created.policySnapshot).toBeDefined();
  });

  test('falls back to the exit details when no last working day is supplied', async () => {
    Employee.findOne.mockResolvedValue(
      employeeDoc({
        exitDetails: {
          lastWorkingDay: new Date('2026-06-20'),
          noticePeriodDays: 30,
        },
      }),
    );
    delete req.body.lastWorkingDay;

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Settlement.create.mock.calls[0][0].settlementMonth).toBe(6);
  });

  test('refuses when no last working day is available anywhere', async () => {
    delete req.body.lastWorkingDay;

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Settlement.create).not.toHaveBeenCalled();
  });

  test('blocks a negative settlement unless explicitly overridden', async () => {
    req.body.assetRecovery = 500000;

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors[0]).toContain('negative');
    expect(Settlement.create).not.toHaveBeenCalled();
  });

  test('commits a negative settlement when the override is given', async () => {
    req.body.assetRecovery = 500000;
    req.body.allowNegative = true;

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Settlement.create.mock.calls[0][0].negativeOverride).toBe(true);
  });

  test('a second live settlement is a 409, not a 500', async () => {
    const duplicate = new Error('E11000');
    duplicate.code = 11000;
    Settlement.create.mockRejectedValue(duplicate);

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  test("another company's employee cannot be settled", async () => {
    Employee.findOne.mockResolvedValue(null);

    await createSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Settlement.create).not.toHaveBeenCalled();
  });
});

describe('updateSettlement (#462)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      params: { id: SETTLEMENT_ID },
      body: { assetRecovery: 2000 },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('recomputes the draft with the new manual lines', async () => {
    const settlement = settlementDoc();
    Settlement.findOne.mockResolvedValue(settlement);

    await updateSettlement(req, res, next);

    expect(settlement.deductions.assetRecovery).toBe(2000);
    expect(settlement.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('refuses to edit anything that is no longer a draft', async () => {
    // Changing the figures underneath a checker is the abuse the approval
    // ladder exists to prevent.
    for (const status of [
      SETTLEMENT_STATUS.PENDING_APPROVAL,
      SETTLEMENT_STATUS.APPROVED,
      SETTLEMENT_STATUS.PAID,
    ]) {
      jest.clearAllMocks();
      const settlement = settlementDoc({ status });
      Settlement.findOne.mockResolvedValue(settlement);
      Employee.findOne.mockResolvedValue(employeeDoc());

      await updateSettlement(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(settlement.save).not.toHaveBeenCalled();
    }
  });

  test("another company's settlement is a 404", async () => {
    Settlement.findOne.mockResolvedValue(null);

    await updateSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects a malformed id before querying', async () => {
    req.params.id = 'nope';

    await updateSettlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Settlement.findOne).not.toHaveBeenCalled();
  });
});

describe('settlement status ladder (#462)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      params: { id: SETTLEMENT_ID },
      body: {},
    };
    res = makeRes();
    next = jest.fn();
  });

  test('a draft can be submitted for review', async () => {
    const settlement = settlementDoc({ status: SETTLEMENT_STATUS.DRAFT });
    Settlement.findOne.mockResolvedValue(settlement);

    await submitSettlement(req, res, next);

    expect(settlement.status).toBe(SETTLEMENT_STATUS.PENDING_APPROVAL);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('a pending settlement can be approved, and the approver is recorded', async () => {
    const settlement = settlementDoc({
      status: SETTLEMENT_STATUS.PENDING_APPROVAL,
    });
    Settlement.findOne.mockResolvedValue(settlement);

    await approveSettlement(req, res, next);

    expect(settlement.status).toBe(SETTLEMENT_STATUS.APPROVED);
    expect(settlement.approvedBy).toBe(OWNER);
    expect(settlement.approvedAt).toBeInstanceOf(Date);
  });

  test('rejection sends it back to draft and requires a reason', async () => {
    const settlement = settlementDoc({
      status: SETTLEMENT_STATUS.PENDING_APPROVAL,
    });
    Settlement.findOne.mockResolvedValue(settlement);

    await rejectSettlement(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);

    jest.clearAllMocks();
    const second = settlementDoc({
      status: SETTLEMENT_STATUS.PENDING_APPROVAL,
    });
    Settlement.findOne.mockResolvedValue(second);
    req.body = { reason: 'Asset recovery looks wrong' };

    await rejectSettlement(req, res, next);

    expect(second.status).toBe(SETTLEMENT_STATUS.DRAFT);
    expect(second.rejectionReason).toBe('Asset recovery looks wrong');
  });

  test('a draft cannot jump straight to paid', async () => {
    const settlement = settlementDoc({ status: SETTLEMENT_STATUS.DRAFT });
    Settlement.findOne.mockResolvedValue(settlement);

    await markSettlementPaid(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(settlement.save).not.toHaveBeenCalled();
  });

  test('paid is terminal', async () => {
    // A settled F&F must not be reopened, for the same reason a paid payroll
    // row must not be (#251).
    for (const handler of [
      submitSettlement,
      approveSettlement,
      cancelSettlement,
    ]) {
      jest.clearAllMocks();
      const settlement = settlementDoc({ status: SETTLEMENT_STATUS.PAID });
      Settlement.findOne.mockResolvedValue(settlement);
      req.body = { reason: 'x' };

      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(settlement.save).not.toHaveBeenCalled();
    }
  });

  test('marking paid exits the employee and preserves their history', async () => {
    const settlement = settlementDoc({ status: SETTLEMENT_STATUS.APPROVED });
    Settlement.findOne.mockResolvedValue(settlement);

    await markSettlementPaid(req, res, next);

    expect(settlement.status).toBe(SETTLEMENT_STATUS.PAID);
    expect(settlement.paidAt).toBeInstanceOf(Date);

    const update = Employee.updateOne.mock.calls[0][1].$set;
    expect(update.employmentStatus).toBe(EMPLOYMENT_STATUS.EXITED);
    expect(update.isActive).toBe(false);

    // Nothing deletes payroll history — that is the whole point.
    expect(PayrollUpdate.deleteMany).not.toHaveBeenCalled();
  });

  test('marking paid invalidates the analytics cache', async () => {
    Settlement.findOne.mockResolvedValue(
      settlementDoc({ status: SETTLEMENT_STATUS.APPROVED }),
    );

    await markSettlementPaid(req, res, next);

    expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith(OWNER);
  });

  test('a status change emits an audit event', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    Settlement.findOne.mockResolvedValue(
      settlementDoc({ status: SETTLEMENT_STATUS.DRAFT }),
    );

    await submitSettlement(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([, payload]) => payload && payload.action === 'SETTLEMENT_STATUS_CHANGE',
    );
    expect(auditCall[1].details.from).toBe(SETTLEMENT_STATUS.DRAFT);
    expect(auditCall[1].details.to).toBe(SETTLEMENT_STATUS.PENDING_APPROVAL);
    emitSpy.mockRestore();
  });

  test('every transition scopes its lookup by tenant', async () => {
    Settlement.findOne.mockResolvedValue(settlementDoc());

    await submitSettlement(req, res, next);

    expect(Settlement.findOne).toHaveBeenCalledWith({
      _id: SETTLEMENT_ID,
      tenantId: TENANT,
    });
  });
});

describe('getSettlements / getSettlementById (#462)', () => {
  test('lists scoped by tenant', async () => {
    const req = { userId: OWNER, tenantId: TENANT, query: {} };
    const res = makeRes();

    await getSettlements(req, res, jest.fn());

    expect(Settlement.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  test('rejects an unknown status filter', async () => {
    const req = {
      userId: OWNER,
      tenantId: TENANT,
      query: { status: 'settled' },
    };
    const res = makeRes();

    await getSettlements(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('clamps pagination', async () => {
    const req = {
      userId: OWNER,
      tenantId: TENANT,
      query: { page: '-3', limit: '9999' },
    };
    const res = makeRes();

    await getSettlements(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].currentPage).toBe(1);
  });

  test('detail reports the preserved payroll history count', async () => {
    Settlement.findOne.mockResolvedValue(settlementDoc());
    PayrollUpdate.countDocuments.mockResolvedValue(14);

    const req = {
      userId: OWNER,
      tenantId: TENANT,
      params: { id: SETTLEMENT_ID },
    };
    const res = makeRes();

    await getSettlementById(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].payrollHistoryCount).toBe(14);
  });
});
