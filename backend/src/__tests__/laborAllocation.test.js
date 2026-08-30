'use strict';

const mongoose = require('mongoose');
const { distributeLaborCost } = require('../services/laborAllocation.service');

describe('Labor Allocation Service', () => {
  describe('distributeLaborCost', () => {
    it('splits salary and benefits proportionally based on timesheet hours', () => {
      const timesheetEntries = [
        { projectCode: 'PRJ-100', costCenter: 'CC-ENG', hours: 60 },
        { projectCode: 'PRJ-200', costCenter: 'CC-RND', hours: 40 },
      ];

      const result = distributeLaborCost({
        employeeId: new mongoose.Types.ObjectId(),
        payrollRunId: new mongoose.Types.ObjectId(),
        grossSalary: 10000,
        overtime: 1000,
        employerTaxes: 1200,
        benefitsCost: 800,
        timesheetEntries,
      });

      expect(result.totalHours).toBe(100);
      expect(result.journalEntries.length).toBe(2);

      // Entry 1: 60% of total
      const entry1 = result.journalEntries.find((e) => e.projectCode === 'PRJ-100');
      expect(entry1.allocationRatio).toBe(0.6);
      expect(entry1.allocatedBaseSalary).toBe(6000);
      expect(entry1.allocatedOvertime).toBe(600);
      expect(entry1.allocatedEmployerTaxes).toBe(720);
      expect(entry1.allocatedBenefitsCost).toBe(480);
      expect(entry1.totalAllocatedCost).toBe(7800);

      // Entry 2: 40% of total
      const entry2 = result.journalEntries.find((e) => e.projectCode === 'PRJ-200');
      expect(entry2.allocationRatio).toBe(0.4);
      expect(entry2.totalAllocatedCost).toBe(5200);

      // Total sum check: 7800 + 5200 = 13,000 (10000 + 1000 + 1200 + 800)
      expect(entry1.totalAllocatedCost + entry2.totalAllocatedCost).toBe(13000);
    });

    it('throws error when timesheet hours are zero or empty', () => {
      expect(() => {
        distributeLaborCost({
          employeeId: new mongoose.Types.ObjectId(),
          payrollRunId: new mongoose.Types.ObjectId(),
          grossSalary: 5000,
          timesheetEntries: [],
        });
      }).toThrow('Timesheet entries or project splits are required for allocation.');
    });
  });
});