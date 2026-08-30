"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyVaultReserveModel = void 0;
class CurrencyVaultReserveModel {
    vaultId;
    ISO3Currency;
    reserveBalance;
    usdEquivalent;
    rateLock;
    isHedgingEnabled;
    updatedAt;
    constructor(data) {
        this.vaultId = data.vaultId || `vlt_${Math.random().toString(36).substr(2, 9)}`;
        this.ISO3Currency = data.ISO3Currency || 'USD';
        this.reserveBalance = data.reserveBalance || 0;
        this.rateLock = data.rateLock || {
            pair: `${this.ISO3Currency}/USD`,
            spotRate: 1.0,
            guaranteedUntil: new Date(Date.now() + 3600000).toISOString(),
            providerDesk: 'Global Treasury Desk',
        };
        this.usdEquivalent = this.reserveBalance * this.rateLock.spotRate;
        this.isHedgingEnabled = data.isHedgingEnabled ?? true;
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }
    toJSON() {
        return {
            vaultId: this.vaultId,
            ISO3Currency: this.ISO3Currency,
            reserveBalance: this.reserveBalance,
            usdEquivalent: this.usdEquivalent,
            rateLock: this.rateLock,
            isHedgingEnabled: this.isHedgingEnabled,
            updatedAt: this.updatedAt,
        };
    }
}
exports.CurrencyVaultReserveModel = CurrencyVaultReserveModel;
//# sourceMappingURL=MultiCurrencyTreasuryModel.js.map