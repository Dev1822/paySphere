const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-global-4.4');
const { executeForecastSimulation, runForecastWorker } = require('../../services/forecast.service');
const ForecastConfiguration = require('../../models/forecastConfiguration.model');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const eventBus = require('../../services/event.service');
const { emitToUser } = require('../../notifications/registry');

let mongoServer;

jest.mock('../../notifications/registry', () => ({
  emitToUser: jest.fn(),
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('forecast.worker and forecast.service', () => {
  let tenantId, userId;

  beforeEach(async () => {
    jest.clearAllMocks();
    await ForecastConfiguration.deleteMany({});
    await PayrollUpdate.deleteMany({});
    await Employee.deleteMany({});

    tenantId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
  });

  describe('runForecastWorker thread calculation', () => {
    it('correctly calculates projected payroll costs, high/low limits, and budget status', async () => {
      const historicalData = [
        { department: 'Engineering', month: 1, year: 2026, totalPayrollCost: 1000 },
        { department: 'Engineering', month: 2, year: 2026, totalPayrollCost: 1100 },
        { department: 'Engineering', month: 3, year: 2026, totalPayrollCost: 900 },
      ];

      const adjustmentFactors = { inflationRate: 5, incrementTrend: 3 }; // +8% trend multiplier
      const confidenceInterval = 0.95;
      const departmentBudgets = { Engineering: 1200 };

      const results = await runForecastWorker({
        historicalData,
        adjustmentFactors,
        confidenceInterval,
        departmentBudgets,
      });

      expect(results.Engineering).toBeDefined();
      // Mean = 1000. Multiplier = 1.08. Projected = 1080.
      expect(results.Engineering.projectedCost).toBe(1080);
      expect(results.Engineering.highEstimate).toBeGreaterThan(1080);
      expect(results.Engineering.lowEstimate).toBeLessThan(1080);
      expect(results.Engineering.isExceeded).toBe(false);
    });
  });

  describe('executeForecastSimulation alerts', () => {
    it('runs forecast task, completes status, and logs warning alerts on budget overruns', async () => {
      // 1. Create employees
      const emp1 = await Employee.create({
        tenantId,
        name: 'Alice Cooper',
        department: 'Sales',
        createdBy: userId,
      });

      // 2. Create historical payroll
      await PayrollUpdate.create({
        employeeId: emp1._id,
        employeeName: 'Alice Cooper',
        tenantId,
        month: 1,
        year: 2026,
        baseSalary: 1000,
        netSalary: 2000,
        createdBy: userId,
      });

      // 3. Create forecast configuration with a low budget limit
      const config = await ForecastConfiguration.create({
        tenantId,
        name: 'Sales Forecast Q2',
        historicalRange: { fromYear: 2026, fromMonth: 1, toYear: 2026, toMonth: 1 },
        targetPeriod: { targetYear: 2026, targetMonth: 2 },
        adjustmentFactors: { inflationRate: 10, incrementTrend: 10 }, // +20% multiplier -> projected cost = 2400
        confidenceInterval: 0.95,
        departmentBudgets: { Sales: 2100 }, // Cap is $2100, which will be exceeded
        status: 'PENDING',
        createdBy: userId,
      });

      const auditLogSpy = jest.fn();
      eventBus.on('AUDIT_LOG', auditLogSpy);

      // Execute simulation
      const completedConfig = await executeForecastSimulation(config._id);

      expect(completedConfig.status).toBe('COMPLETED');
      expect(completedConfig.results.Sales).toBeDefined();
      expect(completedConfig.results.Sales.projectedCost).toBe(2400);
      expect(completedConfig.results.Sales.isExceeded).toBe(true);

      // Verify budget warnings were logged and sent via socket
      expect(auditLogSpy).toHaveBeenCalledTimes(1);
      expect(auditLogSpy.mock.calls[0][0]).toMatchObject({
        action: 'BUDGET_OVERRUN_WARNING',
        resourceType: 'ForecastConfiguration',
      });

      expect(emitToUser).toHaveBeenCalledWith(
        userId.toString(),
        'forecast_alert',
        expect.objectContaining({
          department: 'Sales',
        })
      );

      eventBus.off('AUDIT_LOG', auditLogSpy);
    });
  });
});
