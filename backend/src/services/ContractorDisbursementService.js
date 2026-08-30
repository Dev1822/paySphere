"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractorDisbursementService = void 0;
const express_1 = require("express");
class ContractorDisbursementService {
    contractors = [
        {
            id: 'cntr-501',
            name: 'Mateo Rossi',
            country: 'Italy',
            hourlyRateUSD: 145,
            hoursBilledMonthly: 160,
            monthlyGrossUSD: 23200,
            paymentMethod: 'SWIFT International Wire',
            payoutStatus: 'SCHEDULED',
        },
        {
            id: 'cntr-502',
            name: 'Aarav Sharma',
            country: 'India',
            hourlyRateUSD: 95,
            hoursBilledMonthly: 172,
            monthlyGrossUSD: 16340,
            paymentMethod: 'Wise Business ACH',
            payoutStatus: 'PAID',
        },
    ];
    getContractors() {
        return this.contractors;
    }
    triggerContractorPayout(id) {
        const contractor = this.contractors.find(c => c.id === id);
        if (!contractor)
            return null;
        contractor.payoutStatus = 'PAID';
        return contractor;
    }
}
exports.ContractorDisbursementService = ContractorDisbursementService;
const contractorService = new ContractorDisbursementService();
const contractorRouter = (0, express_1.Router)();
contractorRouter.get('/contractors/list', (req, res) => {
    res.json({ success: true, data: contractorService.getContractors() });
});
contractorRouter.post('/contractors/:id/disburse', (req, res) => {
    const updated = contractorService.triggerContractorPayout(req.params.id);
    if (!updated)
        return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    res.json({ success: true, data: updated });
});
exports.default = contractorRouter;
//# sourceMappingURL=ContractorDisbursementService.js.map