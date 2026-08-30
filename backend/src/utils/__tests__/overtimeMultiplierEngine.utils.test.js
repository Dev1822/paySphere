const {
  computeHourlyOrdinaryWage,
  calculateOvertimePay,
  aggregateMonthlyOvertime,
  RATE_MULTIPLIER_STANDARD_OT,
  RATE_MULTIPLIER_DOUBLE_OT,
  RATE_MULTIPLIER_HOLIDAY_REST_DAY,
} = require('../overtimeMultiplierEngine.utils');

describe('overtimeMultiplierEngine.utils - Overtime & Statutory Rest-Day Engine', () => {
  describe('computeHourlyOrdinaryWage', () => {
    it('computes hourly rate based on 26 days and 8 daily hours', () => {
      const basic = 41600;
      const da = 0; // Total 41600 / (26 * 8 = 208) = 200/hr
      const hourlyRate = computeHourlyOrdinaryWage(basic, da, 26, 8);

      expect(hourlyRate).toBe(200);
    });
  });

  describe('calculateOvertimePay', () => {
    it('computes standard OT at 1.5x and double OT at 2.0x', () => {
      const hourlyRate = 200;
      const standardHours = 2; // 2 * 200 * 1.5 = 600
      const doubleHours = 3;   // 3 * 200 * 2.0 = 1200

      const result = calculateOvertimePay(hourlyRate, standardHours, doubleHours, 0, true);

      expect(result.standardOtPay).toBe(600);
      expect(result.doubleOtPay).toBe(1200);
      expect(result.holidayPay).toBe(0);
      expect(result.totalOtEarnings).toBe(1800);
      expect(result.coffEarnedDays).toBe(0);
    });

    it('computes 2.5x multiplier for holiday cash payout', () => {
      const hourlyRate = 200;
      const holidayHours = 8; // 8 * 200 * 2.5 = 4000

      const result = calculateOvertimePay(hourlyRate, 0, 0, holidayHours, true);

      expect(result.holidayPay).toBe(4000);
      expect(result.totalOtEarnings).toBe(4000);
      expect(result.coffEarnedDays).toBe(0);
    });

    it('credits 1:1 Compensatory Off when employee chooses C-OFF over holiday cash', () => {
      const hourlyRate = 200;
      const holidayHours = 8; // 8 hours = 1.0 day C-OFF

      const result = calculateOvertimePay(hourlyRate, 0, 0, holidayHours, false);

      expect(result.holidayPay).toBe(0);
      expect(result.totalOtEarnings).toBe(0);
      expect(result.coffEarnedDays).toBe(1.0);
    });
  });

  describe('aggregateMonthlyOvertime', () => {
    it('aggregates multiple shifts into standard, double, and holiday buckets', () => {
      const hourlyRate = 200;
      const shifts = [
        { workedHours: 10, isHolidayOrRestDay: false }, // 8h normal, 1h std OT (8-9), 1h dbl OT (>9)
        { workedHours: 8, isHolidayOrRestDay: true, optForHolidayWage: true }, // 8h holiday at 2.5x = 4000
        { workedHours: 8, isHolidayOrRestDay: true, optForHolidayWage: false }, // 8h holiday C-OFF = 1 day
      ];

      const agg = aggregateMonthlyOvertime(shifts, hourlyRate);

      expect(agg.totalShifts).toBe(3);
      expect(agg.totalStandardHours).toBe(1);
      expect(agg.totalDoubleHours).toBe(1);
      expect(agg.totalHolidayHours).toBe(16);
      expect(agg.totalCoffCredited).toBe(1.0);
      // Std: 1 * 200 * 1.5 = 300, Dbl: 1 * 200 * 2.0 = 400, Holiday: 4000 -> Total = 4700
      expect(agg.totalGrossOtEarnings).toBe(4700);
    });
  });
});
