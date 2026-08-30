"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseReconciliationService = void 0;
const express_1 = require("express");
class EnterpriseReconciliationService {
    batches = [
        {
            id: 'rec-401',
            batchName: 'US-East ACH Payroll vs FedWire',
            bankPartner: 'JPMorgan Chase',
            totalDisbursedUSD: 4850000,
            matchedTransactionsCount: 1420,
            unmatchedDiscrepanciesCount: 0,
            varianceUSD: 0.00,
            status: 'PERFECT_MATCH',
        },
        {
            id: 'rec-402',
            batchName: 'UK & EU BACS / SEPA',
            bankPartner: 'Barclays Commercial',
            totalDisbursedUSD: 3120000,
            matchedTransactionsCount: 850,
            unmatchedDiscrepanciesCount: 2,
            varianceUSD: 14.50,
            status: 'VARIANCE_DETECTED',
        },
    ];
    getBatches() {
        return this.batches;
    }
    resolveDiscrepancy(id) {
        const batch = this.batches.find(b => b.id === id);
        if (!batch)
            return null;
        batch.unmatchedDiscrepanciesCount = 0;
        batch.varianceUSD = 0.00;
        batch.status = 'PERFECT_MATCH';
        return { success: true, updatedStatus: batch.status };
    }
}
exports.EnterpriseReconciliationService = EnterpriseReconciliationService;
const reconcileService = new EnterpriseReconciliationService();
const reconcileRouter = (0, express_1.Router)();
reconcileRouter.get('/reconciliation/batches', (req, res) => {
    res.json({ success: true, data: reconcileService.getBatches() });
});
reconcileRouter.post('/reconciliation/batches/:id/resolve', (req, res) => {
    const result = reconcileService.resolveDiscrepancy(req.params.id);
    if (!result)
        return res.status(404).json({ success: false, error: 'Reconciliation batch not found' });
    res.json({ success: true, data: result });
});
exports.default = reconcileRouter;
//# sourceMappingURL=EnterpriseReconciliationService.js.map