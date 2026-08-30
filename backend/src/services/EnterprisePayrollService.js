"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterprisePayrollService = void 0;
const express_1 = require("express");
class EnterprisePayrollService {
    departments = [
        {
            id: 'dept-101',
            departmentName: 'Engineering & Product Development',
            headcount: 142,
            monthlyGrossUSD: 1850000,
            taxWithholdingsUSD: 462500,
            benefitsContributionUSD: 185000,
            netDisbursementUSD: 1202500,
            status: 'DISBURSED',
        },
        {
            id: 'dept-102',
            departmentName: 'Global Sales & Enterprise Accounts',
            headcount: 98,
            monthlyGrossUSD: 1420000,
            taxWithholdingsUSD: 355000,
            benefitsContributionUSD: 142000,
            netDisbursementUSD: 923000,
            status: 'DISBURSED',
        },
    ];
    getPayrollMetrics() {
        return this.departments;
    }
    getDepartmentById(id) {
        return this.departments.find(d => d.id === id);
    }
    triggerDisbursement(id) {
        const dept = this.getDepartmentById(id);
        if (!dept)
            return null;
        dept.status = 'DISBURSED';
        return dept;
    }
}
exports.EnterprisePayrollService = EnterprisePayrollService;
const payrollService = new EnterprisePayrollService();
const payrollRouter = (0, express_1.Router)();
payrollRouter.get('/payroll/departments', (req, res) => {
    const items = payrollService.getPayrollMetrics();
    res.json({ success: true, data: items });
});
payrollRouter.post('/payroll/departments/:id/disburse', (req, res) => {
    const updated = payrollService.triggerDisbursement(req.params.id);
    if (!updated)
        return res.status(404).json({ success: false, error: 'Department not found' });
    res.json({ success: true, data: updated });
});
exports.default = payrollRouter;
//# sourceMappingURL=EnterprisePayrollService.js.map