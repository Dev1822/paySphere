"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxJurisdictionRuleModel = void 0;
class TaxJurisdictionRuleModel {
    jurisdictionId;
    countryISO;
    regionName;
    corporateRatePercent;
    employerPayrollRatePercent;
    employeeWithholdingRatePercent;
    statutoryFilingFrequency;
    filingReceipts;
    isCompliant;
    createdAt;
    constructor(data) {
        this.jurisdictionId = data.jurisdictionId || `juris_${Math.random().toString(36).substr(2, 9)}`;
        this.countryISO = data.countryISO || 'US';
        this.regionName = data.regionName || 'Federal Jurisdiction';
        this.corporateRatePercent = data.corporateRatePercent || 21.0;
        this.employerPayrollRatePercent = data.employerPayrollRatePercent || 15.3;
        this.employeeWithholdingRatePercent = data.employeeWithholdingRatePercent || 12.0;
        this.statutoryFilingFrequency = data.statutoryFilingFrequency || 'QUARTERLY';
        this.filingReceipts = data.filingReceipts || [];
        this.isCompliant = data.isCompliant ?? true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            jurisdictionId: this.jurisdictionId,
            countryISO: this.countryISO,
            regionName: this.regionName,
            corporateRatePercent: this.corporateRatePercent,
            employerPayrollRatePercent: this.employerPayrollRatePercent,
            employeeWithholdingRatePercent: this.employeeWithholdingRatePercent,
            statutoryFilingFrequency: this.statutoryFilingFrequency,
            filingReceipts: this.filingReceipts,
            isCompliant: this.isCompliant,
            createdAt: this.createdAt,
        };
    }
}
exports.TaxJurisdictionRuleModel = TaxJurisdictionRuleModel;
//# sourceMappingURL=MultiJurisdictionTaxModel.js.map