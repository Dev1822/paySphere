"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractorPayoutModel = void 0;
class ContractorPayoutModel {
    contractorId;
    fullName;
    professionalTitle;
    residencyCountry;
    hourlyRateUSD;
    hoursBilled;
    totalGrossInvoiceUSD;
    taxAudit;
    payoutGateway;
    status;
    createdAt;
    constructor(data) {
        this.contractorId = data.contractorId || `cntr_${Math.random().toString(36).substr(2, 9)}`;
        this.fullName = data.fullName || 'Contractor Professional';
        this.professionalTitle = data.professionalTitle || 'Software Engineer';
        this.residencyCountry = data.residencyCountry || 'United States';
        this.hourlyRateUSD = data.hourlyRateUSD || 100;
        this.hoursBilled = data.hoursBilled || 160;
        this.totalGrossInvoiceUSD = this.hourlyRateUSD * this.hoursBilled;
        this.taxAudit = data.taxAudit || {
            formId: 'W8-BEN-2026-901',
            taxIdentityNumber: 'XX-XXX1234',
            countryOfResidence: this.residencyCountry,
            isVerified: true,
            expiresAt: new Date(Date.now() + 31536000000).toISOString(),
        };
        this.payoutGateway = data.payoutGateway || 'SWIFT Wire';
        this.status = data.status || 'SCHEDULED';
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            contractorId: this.contractorId,
            fullName: this.fullName,
            professionalTitle: this.professionalTitle,
            residencyCountry: this.residencyCountry,
            hourlyRateUSD: this.hourlyRateUSD,
            hoursBilled: this.hoursBilled,
            totalGrossInvoiceUSD: this.totalGrossInvoiceUSD,
            taxAudit: this.taxAudit,
            payoutGateway: this.payoutGateway,
            status: this.status,
            createdAt: this.createdAt,
        };
    }
}
exports.ContractorPayoutModel = ContractorPayoutModel;
//# sourceMappingURL=ContractorDisbursementModel.js.map