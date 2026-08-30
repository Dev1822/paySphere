"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseBenefitsService = void 0;
const express_1 = require("express");
class EnterpriseBenefitsService {
    plans = [
        {
            id: 'plan-301',
            planName: 'Platinum PPO Healthcare & Vision',
            providerName: 'BlueCross BlueShield',
            planCategory: 'Medical & Health',
            monthlyEmployerContributionUSD: 650,
            monthlyEmployeeDeductionUSD: 120,
            coveredEmployees: 420,
            status: 'ACTIVE',
        },
        {
            id: 'plan-302',
            planName: 'Global Dental Premier',
            providerName: 'Delta Dental',
            planCategory: 'Dental Care',
            monthlyEmployerContributionUSD: 85,
            monthlyEmployeeDeductionUSD: 20,
            coveredEmployees: 395,
            status: 'ACTIVE',
        },
    ];
    getPlans() {
        return this.plans;
    }
    enrollEmployee(planId, employeeId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan)
            return null;
        plan.coveredEmployees += 1;
        return { success: true, effectiveDate: new Date().toISOString() };
    }
}
exports.EnterpriseBenefitsService = EnterpriseBenefitsService;
const benefitsService = new EnterpriseBenefitsService();
const benefitsRouter = (0, express_1.Router)();
benefitsRouter.get('/benefits/plans', (req, res) => {
    res.json({ success: true, data: benefitsService.getPlans() });
});
benefitsRouter.post('/benefits/plans/:id/enroll', (req, res) => {
    const { employeeId } = req.body;
    const result = benefitsService.enrollEmployee(req.params.id, employeeId);
    if (!result)
        return res.status(404).json({ success: false, error: 'Benefit plan not found' });
    res.json({ success: true, data: result });
});
exports.default = benefitsRouter;
//# sourceMappingURL=EnterpriseBenefitsService.js.map