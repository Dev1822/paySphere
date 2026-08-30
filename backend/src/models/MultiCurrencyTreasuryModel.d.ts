export interface ForexRateLockModel {
    pair: string;
    spotRate: number;
    guaranteedUntil: string;
    providerDesk: string;
}
export declare class CurrencyVaultReserveModel {
    vaultId: string;
    ISO3Currency: string;
    reserveBalance: number;
    usdEquivalent: number;
    rateLock: ForexRateLockModel;
    isHedgingEnabled: boolean;
    updatedAt: string;
    constructor(data: Partial<CurrencyVaultReserveModel>);
    toJSON(): {
        vaultId: string;
        ISO3Currency: string;
        reserveBalance: number;
        usdEquivalent: number;
        rateLock: ForexRateLockModel;
        isHedgingEnabled: boolean;
        updatedAt: string;
    };
}
//# sourceMappingURL=MultiCurrencyTreasuryModel.d.ts.map