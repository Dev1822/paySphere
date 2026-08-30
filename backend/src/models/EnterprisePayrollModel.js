"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollBatchDisbursementModel = void 0;
class PayrollBatchDisbursementModel {
    batchId;
    departmentCode;
    headcount;
    totalGrossAmountUSD;
    taxes;
    netAmountUSD;
    status;
    processedAt;
    constructor(data) {
        this.batchId = data.batchId || `batch_${Math.random().toString(36).substr(2, 9)}`;
        this.departmentCode = data.departmentCode || 'ENG';
        this.headcount = data.headcount || 1;
        this.totalGrossAmountUSD = data.totalGrossAmountUSD || 0;
        this.taxes = data.taxes || {
            federalTaxUSD: this.totalGrossAmountUSD * 0.15,
            stateTaxUSD: this.totalGrossAmountUSD * 0.05,
            socialSecurityUSD: this.totalGrossAmountUSD * 0.062,
            medicareUSD: this.totalGrossAmountUSD * 0.0145,
        };
        this.netAmountUSD = data.netAmountUSD || this.totalGrossAmountUSD - (this.taxes.federalTaxUSD + this.taxes.stateTaxUSD + this.taxes.socialSecurityUSD + this.taxes.medicareUSD);
        this.status = data.status || 'PENDING';
        this.processedAt = data.processedAt || new Date().toISOString();
    }
    toJSON() {
        return {
            batchId: this.batchId,
            departmentCode: this.departmentCode,
            headcount: this.headcount,
            totalGrossAmountUSD: this.totalGrossAmountUSD,
            taxes: this.taxes,
            netAmountUSD: this.netAmountUSD,
            status: this.status,
            processedAt: this.processedAt,
        };
    }
}
exports.PayrollBatchDisbursementModel = PayrollBatchDisbursementModel;
//# sourceMappingURL=EnterprisePayrollModel.js.map