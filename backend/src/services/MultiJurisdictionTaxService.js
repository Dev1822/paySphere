"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiJurisdictionTaxService = void 0;
const express_1 = require("express");
class MultiJurisdictionTaxService {
    jurisdictions = [
        {
            id: 'juris-01',
            countryName: 'United States',
            regionName: 'Federal & State (50 States)',
            corporateTaxRate: 21.0,
            payrollTaxRate: 15.3,
            filingStatus: 'COMPLIANT',
            totalTaxesRemittedUSD: 2450000,
        },
        {
            id: 'juris-02',
            countryName: 'United Kingdom',
            regionName: 'HMRC Pay As You Earn (PAYE)',
            corporateTaxRate: 25.0,
            payrollTaxRate: 13.8,
            filingStatus: 'COMPLIANT',
            totalTaxesRemittedUSD: 890000,
        },
    ];
    getJurisdictions() {
        return this.jurisdictions;
    }
    calculateTaxWithholding(grossSalaryUSD, countryCode) {
        const juris = this.jurisdictions.find(j => j.id === countryCode || j.countryName.toLowerCase() === countryCode.toLowerCase());
        const rate = juris ? juris.payrollTaxRate : 15.0;
        const corpRate = juris ? juris.corporateTaxRate : 20.0;
        return {
            corporateTax: (grossSalaryUSD * corpRate) / 100,
            payrollTax: (grossSalaryUSD * rate) / 100,
        };
    }
}
exports.MultiJurisdictionTaxService = MultiJurisdictionTaxService;
const taxService = new MultiJurisdictionTaxService();
const taxRouter = (0, express_1.Router)();
taxRouter.get('/compliance/tax-jurisdictions', (req, res) => {
    res.json({ success: true, data: taxService.getJurisdictions() });
});
taxRouter.post('/compliance/calculate-tax', (req, res) => {
    const { grossSalaryUSD, countryCode } = req.body;
    const result = taxService.calculateTaxWithholding(grossSalaryUSD, countryCode);
    res.json({ success: true, data: result });
});
exports.default = taxRouter;
//# sourceMappingURL=MultiJurisdictionTaxService.js.map