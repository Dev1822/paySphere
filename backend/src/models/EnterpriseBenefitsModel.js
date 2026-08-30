"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseBenefitsModel = void 0;
class EnterpriseBenefitsModel {
    planId;
    planName;
    carrierProvider;
    category;
    employerContributionUSD;
    employeeDeductionUSD;
    enrolledCount;
    annualDeductibleUSD;
    activeEnrollments;
    isERISACompliant;
    createdAt;
    constructor(data) {
        this.planId = data.planId || `plan_${Math.random().toString(36).substr(2, 9)}`;
        this.planName = data.planName || 'Comprehensive Health Plan';
        this.carrierProvider = data.carrierProvider || 'National Healthcare Corp';
        this.category = data.category || 'Medical';
        this.employerContributionUSD = data.employerContributionUSD || 500;
        this.employeeDeductionUSD = data.employeeDeductionUSD || 100;
        this.enrolledCount = data.enrolledCount || 50;
        this.annualDeductibleUSD = data.annualDeductibleUSD || 250;
        this.activeEnrollments = data.activeEnrollments || [];
        this.isERISACompliant = data.isERISACompliant ?? true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            planId: this.planId,
            planName: this.planName,
            carrierProvider: this.carrierProvider,
            category: this.category,
            employerContributionUSD: this.employerContributionUSD,
            employeeDeductionUSD: this.employeeDeductionUSD,
            enrolledCount: this.enrolledCount,
            annualDeductibleUSD: this.annualDeductibleUSD,
            activeEnrollments: this.activeEnrollments,
            isERISACompliant: this.isERISACompliant,
            createdAt: this.createdAt,
        };
    }
}
exports.EnterpriseBenefitsModel = EnterpriseBenefitsModel;
//# sourceMappingURL=EnterpriseBenefitsModel.js.map