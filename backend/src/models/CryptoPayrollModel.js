"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoVaultWalletModel = void 0;
class CryptoVaultWalletModel {
    walletId;
    chainNetwork;
    tokenSymbol;
    publicAddress;
    tokenBalance;
    usdValuation;
    isMultiSigSecured;
    recentReceipts;
    createdAt;
    constructor(data) {
        this.walletId = data.walletId || `wlt_${Math.random().toString(36).substr(2, 9)}`;
        this.chainNetwork = data.chainNetwork || 'Solana Network';
        this.tokenSymbol = data.tokenSymbol || 'USDC-SPL';
        this.publicAddress = data.publicAddress || '8xZ9...44mA';
        this.tokenBalance = data.tokenBalance || 0;
        this.usdValuation = data.usdValuation || this.tokenBalance;
        this.isMultiSigSecured = data.isMultiSigSecured ?? true;
        this.recentReceipts = data.recentReceipts || [];
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            walletId: this.walletId,
            chainNetwork: this.chainNetwork,
            tokenSymbol: this.tokenSymbol,
            publicAddress: this.publicAddress,
            tokenBalance: this.tokenBalance,
            usdValuation: this.usdValuation,
            isMultiSigSecured: this.isMultiSigSecured,
            recentReceipts: this.recentReceipts,
            createdAt: this.createdAt,
        };
    }
}
exports.CryptoVaultWalletModel = CryptoVaultWalletModel;
//# sourceMappingURL=CryptoPayrollModel.js.map