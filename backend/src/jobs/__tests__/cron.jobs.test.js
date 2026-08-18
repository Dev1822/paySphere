const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const CronLock = require('../../models/cronlock.model');
const Tenant = require('../../models/tenant.model');
const { sendPayslipEmail } = require('../../services/email.service');
const { sendEmail } = require('../../utils/email');
const {
  runMonthlyPayslipJob,
  runDailyGreetingsJob,
  previousPeriod,
} = require('../cron.jobs');

jest.mock('../../models/payroll.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/cronlock.model');
jest.mock('../../models/tenant.model');
jest.mock('../../services/email.service', () => ({
  sendPayslipEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const duplicateKey = () => Object.assign(new Error('dup'), { code: 11000 });

const payrollRow = (id, overrides = {}) => ({
  _id: id,
  employeeId: `emp-${id}`,
  month: 7,
  year: 2026,
  netSalary: 50000,
  payslipEmailed: false,
  status: 'approved',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  CronLock.create.mockResolvedValue({});
  CronLock.deleteOne.mockResolvedValue({ deletedCount: 1 });
  PayrollUpdate.find.mockResolvedValue([]);
  PayrollUpdate.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Employee.find.mockResolvedValue([]);
  Tenant.find.mockResolvedValue([{ _id: 't1', name: 'Analytical Engines' }]);
  Tenant.findOne.mockResolvedValue({
    _id: 't1',
    name: 'Analytical Engines',
    isActive: true,
  });
});

describe('previousPeriod', () => {
  test('returns the month that just ended', () => {
    expect(previousPeriod(new Date(2026, 7, 1))).toEqual({
      month: 7,
      year: 2026,
    });
  });

  test('rolls back across a year boundary', () => {
    expect(previousPeriod(new Date(2026, 0, 1))).toEqual({
      month: 12,
      year: 2025,
    });
  });

  test('does not skip February when run from a 31-day month', () => {
    // `setMonth(getMonth() - 1)` on 31 March lands on 3 March, reporting March
    // as the previous month. Anchoring to the 1st first avoids that.
    expect(previousPeriod(new Date(2026, 2, 31))).toEqual({
      month: 2,
      year: 2026,
    });
  });
});

describe('runMonthlyPayslipJob — status vocabulary (#560)', () => {
  test('matches emailable statuses, not the retired "finalized" literal', async () => {
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    const query = PayrollUpdate.find.mock.calls[0][0];

    expect(query.month).toBe(7);
    expect(query.year).toBe(2026);
    // Not `false`: that misses legacy rows written before the field existed.
    expect(query.payslipEmailed).toEqual({ $ne: true });
    expect(query.status.$in).toEqual(
      expect.arrayContaining(['approved', 'paid']),
    );
  });

  test('still matches legacy rows the migration has not reached', async () => {
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    const query = PayrollUpdate.find.mock.calls[0][0];
    expect(query.status.$in).toContain('finalized');
  });

  test('matches a legacy row that has no payslipEmailed field at all', async () => {
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    const query = PayrollUpdate.find.mock.calls[0][0];
    // `{ payslipEmailed: false }` would skip these documents entirely.
    expect(query.payslipEmailed).not.toBe(false);
    expect(query.payslipEmailed.$ne).toBe(true);
  });

  test('never picks up an unapproved or rejected run', async () => {
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    const query = PayrollUpdate.find.mock.calls[0][0];
    expect(query.status.$in).not.toContain('pending_approval');
    expect(query.status.$in).not.toContain('rejected');
    expect(query.status.$in).not.toContain('draft');
  });

  test('sends an approved payslip and marks the row emailed', async () => {
    PayrollUpdate.find.mockResolvedValue([payrollRow('p1')]);
    Employee.findById.mockResolvedValue({
      _id: 'emp-p1',
      email: 'ada@example.com',
    });

    const result = await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(sendPayslipEmail).toHaveBeenCalledTimes(1);
    expect(PayrollUpdate.updateOne).toHaveBeenCalledWith(
      { _id: 'p1' },
      { $set: { payslipEmailed: true } },
    );
    expect(result).toMatchObject({ ran: true, found: 1, sent: 1, failed: 0 });
  });
});

describe('runMonthlyPayslipJob — resilience', () => {
  test('one failure does not stop the rest of the batch', async () => {
    PayrollUpdate.find.mockResolvedValue([
      payrollRow('p1'),
      payrollRow('p2'),
      payrollRow('p3'),
    ]);
    Employee.findById.mockResolvedValue({ _id: 'e', email: 'a@example.com' });
    sendPayslipEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SMTP said no'))
      .mockResolvedValueOnce(undefined);

    const result = await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(result).toMatchObject({ found: 3, sent: 2, failed: 1 });
  });

  test('counts employees with no address instead of silently ignoring them', async () => {
    PayrollUpdate.find.mockResolvedValue([payrollRow('p1'), payrollRow('p2')]);
    Employee.findById
      .mockResolvedValueOnce({ _id: 'e1', email: '' })
      .mockResolvedValueOnce(null);

    const result = await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(result).toMatchObject({ found: 2, sent: 0, skipped: 2 });
    expect(sendPayslipEmail).not.toHaveBeenCalled();
  });

  test('a query failure does not throw out of the job', async () => {
    PayrollUpdate.find.mockRejectedValue(new Error('DB exploded'));

    const result = await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(result).toMatchObject({ ran: false, reason: 'error' });
  });
});

describe('runMonthlyPayslipJob — locking', () => {
  test('keys the lock on the period it is processing', async () => {
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(CronLock.create).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'monthly_payslip_2026_7' }),
    );
  });

  test('skips when another instance already holds the lock', async () => {
    CronLock.create.mockRejectedValue(duplicateKey());

    const result = await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(result).toMatchObject({ ran: false, reason: 'held' });
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });

  test('releases the lock when nothing was sent, so a retry is possible', async () => {
    // The bug looked exactly like a quiet month. Holding the lock for 24 hours
    // on a zero-result run meant a same-day fix was skipped in silence.
    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(CronLock.deleteOne).toHaveBeenCalledWith({
      _id: 'monthly_payslip_2026_7',
    });
  });

  test('keeps the lock once payslips have actually gone out', async () => {
    PayrollUpdate.find.mockResolvedValue([payrollRow('p1')]);
    Employee.findById.mockResolvedValue({ _id: 'e', email: 'a@example.com' });

    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(CronLock.deleteOne).not.toHaveBeenCalled();
  });

  test('releases the lock when the run fails', async () => {
    PayrollUpdate.find.mockRejectedValue(new Error('DB exploded'));

    await runMonthlyPayslipJob({ now: new Date(2026, 7, 1) });

    expect(CronLock.deleteOne).toHaveBeenCalledWith({
      _id: 'monthly_payslip_2026_7',
    });
  });
});

describe('runDailyGreetingsJob', () => {
  const employee = (overrides) => ({
    _id: 'e1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    companyName: 'Analytical Engines',
    ...overrides,
  });

  test('greets a birthday that falls today and filters by tenantId', async () => {
    Employee.find.mockResolvedValue([
      employee({ dateOfBirth: new Date(1990, 7, 3) }),
    ]);

    const result = await runDailyGreetingsJob({ now: new Date(2026, 7, 3) });

    expect(Tenant.find).toHaveBeenCalledWith({ isActive: true });
    expect(Employee.find).toHaveBeenCalledWith({
      tenantId: 't1',
      isActive: true,
      email: { $exists: true, $ne: '' },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toContain('Happy Birthday');
    expect(result).toMatchObject({ ran: true, sent: 1 });
  });

  test('iterates over multiple active tenants', async () => {
    Tenant.find.mockResolvedValue([
      { _id: 't1', name: 'Tenant 1' },
      { _id: 't2', name: 'Tenant 2' },
    ]);
    Employee.find.mockImplementation((query) => {
      if (query.tenantId === 't1') {
        return Promise.resolve([
          employee({ _id: 'e1', dateOfBirth: new Date(1990, 7, 3) }),
        ]);
      }
      if (query.tenantId === 't2') {
        return Promise.resolve([
          employee({ _id: 'e2', dateOfBirth: new Date(1990, 7, 3) }),
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await runDailyGreetingsJob({ now: new Date(2026, 7, 3) });

    expect(Tenant.find).toHaveBeenCalledWith({ isActive: true });
    expect(Employee.find).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ran: true, sent: 2 });
  });

  test('filters by specific tenantId when passed', async () => {
    await runDailyGreetingsJob({
      now: new Date(2026, 7, 3),
      tenantId: 't2',
    });

    expect(Tenant.findOne).toHaveBeenCalledWith({ _id: 't2', isActive: true });
    expect(Tenant.find).not.toHaveBeenCalled();
    expect(Employee.find).toHaveBeenCalledWith({
      tenantId: 't2',
      isActive: true,
      email: { $exists: true, $ne: '' },
    });
  });

  test('skips when another instance already holds the lock', async () => {
    CronLock.create.mockRejectedValue(duplicateKey());

    const result = await runDailyGreetingsJob({ now: new Date(2026, 7, 3) });

    expect(result).toMatchObject({ ran: false, reason: 'held' });
    expect(Employee.find).not.toHaveBeenCalled();
  });
});
