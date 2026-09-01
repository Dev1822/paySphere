"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseEquityService = void 0;
const express_1 = require("express");
class EnterpriseEquityService {
    grants = [
        {
            id: 'eq-1001',
            granteeName: 'Elena Rostova',
            roleTitle: 'VP of Engineering',
            grantType: 'ISO Stock Options',
            sharesGranted: 125000,
            strikePriceUSD: 1.25,
            currentFairMarketValueUSD: 18.50,
            vestingProgressPercent: 50.0,
            status: 'ACTIVE_VESTING',
        },
        {
            id: 'eq-1002',
            granteeName: 'Marcus Vance',
            roleTitle: 'Principal Architect',
            grantType: 'RSUs',
            sharesGranted: 85000,
            strikePriceUSD: 0.00,
            currentFairMarketValueUSD: 18.50,
            vestingProgressPercent: 50.0,
            status: 'ACTIVE_VESTING',
        },
    ];
    getGrants() {
        return this.grants;
    }
    exerciseOptionGrant(id, sharesToExercise) {
        const grant = this.grants.find(g => g.id === id);
        if (!grant)
            return null;
        const totalCostUSD = sharesToExercise * grant.strikePriceUSD;
        return { success: true, totalCostUSD, remainingShares: grant.sharesGranted - sharesToExercise };
    }
}
exports.EnterpriseEquityService = EnterpriseEquityService;
const equityService = new EnterpriseEquityService();
const equityRouter = (0, express_1.Router)();
equityRouter.get('/equity/grants', (req, res) => {
    res.json({ success: true, data: equityService.getGrants() });
});
equityRouter.post('/equity/grants/:id/exercise', (req, res) => {
    const { sharesToExercise } = req.body;
    const result = equityService.exerciseOptionGrant(req.params.id, sharesToExercise);
    if (!result)
        return res.status(404).json({ success: false, error: 'Grant profile not found' });
    res.json({ success: true, data: result });
});
exports.default = equityRouter;
//# sourceMappingURL=EnterpriseEquityService.js.map