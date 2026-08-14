'use strict';

const {
  isValidPAN,
  calculateTDS,
  aggregateForm16AQuarterly,
} = require('../contractorTdsCalculator');

jest.mock('../../models/vendor.model', () => ({
  VendorInvoice: {
    aggregate: jest.fn().mockResolvedValue([]),
  },
}));

describe('Contractor & Professional TDS Engine (Section 194C / 194J)', () => {
  describe('isValidPAN', () => {
    it('validates correct Indian PAN format', () => {
      expect(isValidPAN('ABCDE1234F')).toBe(true);
      expect(isValidPAN('abcde1234f')).toBe(true);
    });

    it('rejects invalid PAN strings', () => {
      expect(isValidPAN('INVALID123')).toBe(false);
      expect(isValidPAN('12345ABCDE')).toBe(false);
      expect(isValidPAN(null)).toBe(false);
      expect(isValidPAN('')).toBe(false);
    });
  });

  describe('calculateTDS under Section 194C', () => {
    it('applies 0% TDS when single bill <= 30,000 and aggregate <= 1,00,000', async () => {
      const vendor = {
        _id: 'v1',
        pan: 'ABCDE1234F',
        vendorType: 'Individual/HUF',
      };

      const result = await calculateTDS(vendor, 25000, 2026, 'tenant123', '194C');
      expect(result.thresholdBreached).toBe(false);
      expect(result.tdsRate).toBe(0);
      expect(result.tdsAmount).toBe(0);
      expect(result.netPayable).toBe(25000);
    });

    it('applies 1% TDS for Individual/HUF when single bill > 30,000', async () => {
      const vendor = {
        _id: 'v1',
        pan: 'ABCDE1234F',
        vendorType: 'Individual/HUF',
      };

      const result = await calculateTDS(vendor, 50000, 2026, 'tenant123', '194C');
      expect(result.thresholdBreached).toBe(true);
      expect(result.tdsRate).toBe(1);
      expect(result.tdsAmount).toBe(500);
      expect(result.netPayable).toBe(49500);
    });

    it('applies 2% TDS for Company/Firm when single bill > 30,000', async () => {
      const vendor = {
        _id: 'v2',
        pan: 'ABCDE1234F',
        vendorType: 'Company',
      };

      const result = await calculateTDS(vendor, 100000, 2026, 'tenant123', '194C');
      expect(result.thresholdBreached).toBe(true);
      expect(result.tdsRate).toBe(2);
      expect(result.tdsAmount).toBe(2000);
      expect(result.netPayable).toBe(98000);
    });

    it('imposes 20% penalty rate when PAN is invalid / missing', async () => {
      const vendor = {
        _id: 'v3',
        pan: 'INVALID',
        vendorType: 'Individual/HUF',
      };

      const result = await calculateTDS(vendor, 50000, 2026, 'tenant123', '194C');
      expect(result.thresholdBreached).toBe(true);
      expect(result.tdsRate).toBe(20);
      expect(result.tdsAmount).toBe(10000);
      expect(result.netPayable).toBe(40000);
    });
  });

  describe('calculateTDS under Section 194J', () => {
    it('applies 10% TDS for professional services exceeding ₹30,000', async () => {
      const vendor = {
        _id: 'v4',
        pan: 'ABCDE1234F',
        vendorType: 'Professional',
      };

      const result = await calculateTDS(vendor, 40000, 2026, 'tenant123', '194J');
      expect(result.thresholdBreached).toBe(true);
      expect(result.tdsRate).toBe(10);
      expect(result.tdsAmount).toBe(4000);
      expect(result.netPayable).toBe(36000);
    });
  });

  describe('aggregateForm16AQuarterly', () => {
    it('groups invoices by Indian fiscal quarters Q1, Q2, Q3, Q4', () => {
      const invoices = [
        { invoiceDate: new Date('2026-05-10'), grossAmount: 50000, tdsAmount: 500, financialYear: 2026 }, // Q1
        { invoiceDate: new Date('2026-08-15'), grossAmount: 80000, tdsAmount: 800, financialYear: 2026 }, // Q2
        { invoiceDate: new Date('2026-11-20'), grossAmount: 40000, tdsAmount: 400, financialYear: 2026 }, // Q3
        { invoiceDate: new Date('2027-02-10'), grossAmount: 30000, tdsAmount: 300, financialYear: 2026 }, // Q4
      ];

      const report = aggregateForm16AQuarterly(invoices, 2026);
      expect(report.totalGross).toBe(200000);
      expect(report.totalTds).toBe(2000);
      expect(report.quarters.Q1.grossAmount).toBe(50000);
      expect(report.quarters.Q2.grossAmount).toBe(80000);
      expect(report.quarters.Q3.grossAmount).toBe(40000);
      expect(report.quarters.Q4.grossAmount).toBe(30000);
    });
  });
});
