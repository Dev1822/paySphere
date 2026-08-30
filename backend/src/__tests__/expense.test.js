/**
 * Expense claims, end to end through the controller (#719, #794).
 *
 * The suite this replaces asserted arithmetic it had written itself:
 *
 *     // Simulate the logic from payroll.controller.js
 *     const totalBonusWithExpenses = baseBonus + taxableExpenses;
 *     expect(totalBonusWithExpenses).toBe(700);
 *
 * That passes no matter what `payroll.controller.js` does, which is how a
 * taxable claim came to be stamped `reimbursed` without its value ever reaching
 * anyone's net pay. Everything below calls the real controller.
 */

const mongoose = require('mongoose');

jest.mock('../models/expenseClaim.model');
jest.mock('../models/expenseCategory.model');
jest.mock('../models/employee.model');
jest.mock('../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../services/objectStorage.service', () => ({
  createObjectKey: jest.fn(() => 'tenants/test/expenses/receipt.jpg'),
  deleteObject: jest.fn().mockResolvedValue(true),
  getDownloadUrl: jest.fn(async (uri) => `https://signed.example/${encodeURIComponent(uri)}`),
  isStorageUri: jest.fn((value) => String(value).startsWith('s3://')),
  putObject: jest.fn().mockResolvedValue({
    uri: 's3://test-bucket/tenants/test/expenses/receipt.jpg',
    key: 'tenants/test/expenses/receipt.jpg',
  }),
}));

const ExpenseClaim = require('../models/expenseClaim.model');
const ExpenseCategory = require('../models/expenseCategory.model');
const Employee = require('../models/employee.model');
const eventBus = require('../services/event.service');
const { ACCOUNT_TYPE } = require('../config/accountTypes');
const {
  submitExpense,
  getExpenses,
  updateExpenseStatus,
  createCategory,
  updateCategory,
} = require('../controllers/expense.controller');

const TENANT = new mongoose.Types.ObjectId();
const EMPLOYEE = new mongoose.Types.ObjectId();
const OTHER_EMPLOYEE = new mongoose.Types.ObjectId();
const CATEGORY = new mongoose.Types.ObjectId();
const MAKER = new mongoose.Types.ObjectId();
const CHECKER = new mongoose.Types.ObjectId();

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildReq(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    files: [],
    userId: MAKER,
    tenantId: TENANT,
    accountType: ACCOUNT_TYPE.ADMIN,
    user: {},
    ...overrides,
  };
}

/** The chainable shape `getExpenses` builds. */
function findChain(rows) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();

  Employee.findOne = jest.fn().mockResolvedValue({
    _id: EMPLOYEE,
    fullName: 'Alice',
    currency: 'INR',
  });
  ExpenseCategory.findOne = jest
    .fn()
    .mockResolvedValue({ _id: CATEGORY, name: 'Travel', isTaxable: false });
  ExpenseClaim.create = jest
    .fn()
    .mockImplementation(async (doc) => ({ _id: 'claim-1', ...doc }));
  ExpenseClaim.countDocuments = jest.fn().mockResolvedValue(0);
});

describe('submitExpense (#794)', () => {
  const validBody = () => ({
    employeeId: String(EMPLOYEE),
    categoryId: String(CATEGORY),
    amount: '250.50',
    expenseDate: '2026-08-20',
    description: 'Client site visit, return fare',
  });

  it('creates a claim in pending_approval and audits it', async () => {
    const req = buildReq({ body: validBody() });
    const res = buildRes();

    await submitExpense(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);

    const [created] = ExpenseClaim.create.mock.calls[0];
    expect(created).toMatchObject({
      tenantId: TENANT,
      employeeId: String(EMPLOYEE),
      amount: 250.5,
      status: 'pending_approval',
      submittedBy: MAKER,
    });

    expect(eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({ action: 'EXPENSE_SUBMIT' }),
    );
  });

  it.each([
    ['a zero amount', { amount: '0' }],
    ['a negative amount', { amount: '-40' }],
    ['a non-numeric amount', { amount: 'lots' }],
    ['a missing date', { expenseDate: undefined }],
    ['an unparseable date', { expenseDate: 'last tuesday' }],
    ['an empty description', { description: '   ' }],
  ])('rejects %s with a 400', async (_label, patch) => {
    const req = buildReq({ body: { ...validBody(), ...patch } });
    const res = buildRes();

    await submitExpense(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ExpenseClaim.create).not.toHaveBeenCalled();
  });

  it('404s when the employee is not in the caller tenant', async () => {
    Employee.findOne.mockResolvedValue(null);

    const res = buildRes();
    await submitExpense(buildReq({ body: validBody() }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('404s when the category is missing or inactive', async () => {
    ExpenseCategory.findOne.mockResolvedValue(null);

    const res = buildRes();
    await submitExpense(buildReq({ body: validBody() }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  describe('an employee self-service login', () => {
    it('may file its own receipts', async () => {
      const req = buildReq({
        body: validBody(),
        accountType: ACCOUNT_TYPE.EMPLOYEE,
        user: { employeeId: EMPLOYEE },
      });
      const res = buildRes();

      await submitExpense(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('may not file against a colleague', async () => {
      // WRITE_EXPENSE was all it took: `employeeId` came straight off the body
      // and the only check was that it belonged to the same tenant.
      const req = buildReq({
        body: { ...validBody(), employeeId: String(OTHER_EMPLOYEE) },
        accountType: ACCOUNT_TYPE.EMPLOYEE,
        user: { employeeId: EMPLOYEE },
      });
      const res = buildRes();

      await submitExpense(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(ExpenseClaim.create).not.toHaveBeenCalled();
    });

    it('is refused when it is linked to no employee record', async () => {
      const req = buildReq({
        body: validBody(),
        accountType: ACCOUNT_TYPE.EMPLOYEE,
        user: {},
      });
      const res = buildRes();

      await submitExpense(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  it('records the stored receipt path, not the client filename', async () => {
    const req = buildReq({
      body: validBody(),
      files: [
        {
          buffer: Buffer.from('receipt'),
          filename: 'b7c1f0a2-0000-4000-8000-000000000000.jpg',
          originalname: '../../etc/passwd',
          mimetype: 'image/jpeg',
          size: 1024,
        },
      ],
    });

    await submitExpense(req, buildRes(), jest.fn());

    const [created] = ExpenseClaim.create.mock.calls[0];
    expect(created.receipts[0].url).toBe(
      's3://test-bucket/tenants/test/expenses/receipt.jpg',
    );
    expect(created.receipts[0].url).not.toContain('..');
  });
});

describe('getExpenses (#794)', () => {
  it('scopes every read by tenant', async () => {
    ExpenseClaim.find = jest.fn().mockReturnValue(findChain([]));

    await getExpenses(buildReq(), buildRes(), jest.fn());

    expect(ExpenseClaim.find.mock.calls[0][0]).toMatchObject({
      tenantId: TENANT,
    });
  });

  it('pins an employee login to its own claims whatever it asks for', async () => {
    ExpenseClaim.find = jest.fn().mockReturnValue(findChain([]));

    const req = buildReq({
      query: { employeeId: String(OTHER_EMPLOYEE) },
      accountType: ACCOUNT_TYPE.EMPLOYEE,
      user: { employeeId: EMPLOYEE },
    });

    await getExpenses(req, buildRes(), jest.fn());

    expect(String(ExpenseClaim.find.mock.calls[0][0].employeeId)).toBe(
      String(EMPLOYEE),
    );
  });

  it('caps the page size a caller can ask for', async () => {
    const chain = findChain([]);
    ExpenseClaim.find = jest.fn().mockReturnValue(chain);

    await getExpenses(
      buildReq({ query: { limit: '100000' } }),
      buildRes(),
      jest.fn(),
    );

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('falls back to the defaults on nonsense pagination', async () => {
    const chain = findChain([]);
    ExpenseClaim.find = jest.fn().mockReturnValue(chain);

    await getExpenses(
      buildReq({ query: { page: 'abc', limit: '-5' } }),
      buildRes(),
      jest.fn(),
    );

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });
});

describe('updateExpenseStatus (#794)', () => {
  function pendingClaim(overrides = {}) {
    return {
      _id: 'claim-1',
      status: 'pending_approval',
      amount: 250,
      submittedBy: MAKER,
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  it('approves a claim submitted by somebody else', async () => {
    const claim = pendingClaim();
    ExpenseClaim.findOne = jest.fn().mockResolvedValue(claim);

    const req = buildReq({
      params: { id: String(CATEGORY) },
      body: { status: 'approved' },
      userId: CHECKER,
    });
    const res = buildRes();

    await updateExpenseStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(claim.status).toBe('approved');
    expect(claim.approvedBy).toBe(CHECKER);
    expect(claim.approvedAt).toBeInstanceOf(Date);
  });

  it('refuses to let the submitter approve their own claim', async () => {
    // The same maker-checker separation #458 established for payroll.
    ExpenseClaim.findOne = jest.fn().mockResolvedValue(pendingClaim());

    const res = buildRes();
    await updateExpenseStatus(
      buildReq({
        params: { id: String(CATEGORY) },
        body: { status: 'approved' },
        userId: MAKER,
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('records a rejection on the rejection fields, not the approval ones', async () => {
    const claim = pendingClaim();
    ExpenseClaim.findOne = jest.fn().mockResolvedValue(claim);

    await updateExpenseStatus(
      buildReq({
        params: { id: String(CATEGORY) },
        body: { status: 'rejected', rejectionReason: 'No receipt attached' },
        userId: CHECKER,
      }),
      buildRes(),
      jest.fn(),
    );

    expect(claim.rejectedBy).toBe(CHECKER);
    expect(claim.rejectedAt).toBeInstanceOf(Date);
    expect(claim.approvedBy).toBeUndefined();
    expect(claim.approvedAt).toBeUndefined();
  });

  it('requires a reason to reject', async () => {
    ExpenseClaim.findOne = jest.fn().mockResolvedValue(pendingClaim());

    const res = buildRes();
    await updateExpenseStatus(
      buildReq({
        params: { id: String(CATEGORY) },
        body: { status: 'rejected' },
        userId: CHECKER,
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('will not re-process a claim that is already decided', async () => {
    ExpenseClaim.findOne = jest
      .fn()
      .mockResolvedValue(pendingClaim({ status: 'reimbursed' }));

    const res = buildRes();
    await updateExpenseStatus(
      buildReq({
        params: { id: String(CATEGORY) },
        body: { status: 'approved' },
        userId: CHECKER,
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('expense categories (#794)', () => {
  it('creates one, defaulting to tax-free', async () => {
    ExpenseCategory.create = jest
      .fn()
      .mockImplementation(async (doc) => ({ _id: CATEGORY, ...doc }));

    const res = buildRes();
    await createCategory(
      buildReq({ body: { name: 'Travel' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(ExpenseCategory.create.mock.calls[0][0]).toMatchObject({
      tenantId: TENANT,
      name: 'Travel',
      isTaxable: false,
    });
  });

  it('reports a duplicate name as a conflict, not a 500', async () => {
    ExpenseCategory.create = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const res = buildRes();
    await createCategory(
      buildReq({ body: { name: 'Travel' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses to flip isTaxable while claims are awaiting reimbursement', async () => {
    // Flipping the flag re-prices every claim already approved under it: a
    // taxable one goes in as earnings before tax, a tax-free one is added to
    // net pay afterwards.
    ExpenseCategory.findOne = jest.fn().mockResolvedValue({
      _id: CATEGORY,
      isTaxable: false,
      save: jest.fn(),
    });
    ExpenseClaim.countDocuments = jest.fn().mockResolvedValue(3);

    const res = buildRes();
    await updateCategory(
      buildReq({ params: { id: String(CATEGORY) }, body: { isTaxable: true } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('allows the flip once nothing is outstanding', async () => {
    const category = { _id: CATEGORY, isTaxable: false, save: jest.fn() };
    ExpenseCategory.findOne = jest.fn().mockResolvedValue(category);
    ExpenseClaim.countDocuments = jest.fn().mockResolvedValue(0);

    const res = buildRes();
    await updateCategory(
      buildReq({ params: { id: String(CATEGORY) }, body: { isTaxable: true } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(category.isTaxable).toBe(true);
  });
});
