"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiCurrencyTreasuryService = void 0;
const express_1 = require("express");
class MultiCurrencyTreasuryService {
    vaults = [
        {
            id: 'vlt-01',
            currencyCode: 'USD',
            totalBalance: 8450000.50,
            fxRateToUSD: 1.0,
            hedgedPercentage: 100,
            status: 'ACTIVE',
        },
        {
            id: 'vlt-02',
            currencyCode: 'EUR',
            totalBalance: 3200000.00,
            fxRateToUSD: 1.085,
            hedgedPercentage: 85,
            status: 'ACTIVE',
        },
        {
            id: 'vlt-03',
            currencyCode: 'GBP',
            totalBalance: 1950000.75,
            fxRateToUSD: 1.272,
            hedgedPercentage: 90,
            status: 'ACTIVE',
        },
    ];
    getVaults() {
        return this.vaults;
    }
    getVaultByCode(code) {
        return this.vaults.find(v => v.currencyCode.toUpperCase() === code.toUpperCase());
    }
    executeLiquiditySwap(fromCurrency, toCurrency, amount) {
        const vault = this.getVaultByCode(fromCurrency);
        if (!vault || vault.totalBalance < amount) {
            return { success: false, convertedUSD: 0 };
        }
        vault.totalBalance -= amount;
        const convertedUSD = amount * vault.fxRateToUSD;
        return { success: true, convertedUSD };
    }
}
exports.MultiCurrencyTreasuryService = MultiCurrencyTreasuryService;
const treasuryService = new MultiCurrencyTreasuryService();
const treasuryRouter = (0, express_1.Router)();
treasuryRouter.get('/treasury/vaults', (req, res) => {
    res.json({ success: true, data: treasuryService.getVaults() });
});
treasuryRouter.post('/treasury/swap', (req, res) => {
    const { fromCurrency, toCurrency, amount } = req.body;
    const result = treasuryService.executeLiquiditySwap(fromCurrency, toCurrency, amount);
    if (!result.success) {
        return res.status(400).json({ success: false, error: 'Insufficient vault liquidity' });
    }
    res.json({ success: true, data: result });
});
exports.default = treasuryRouter;
//# sourceMappingURL=MultiCurrencyTreasuryService.js.map