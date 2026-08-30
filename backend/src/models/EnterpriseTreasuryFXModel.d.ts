export interface SettlementLegDTO {
    legId: string;
    currency: string;
    amount: number;
    isSettled: boolean;
}
export declare class EnterpriseTreasuryFXModel {
    swapId: string;
    baseCurrency: string;
    quoteCurrency: string;
    spotRate: number;
    forwardPoints: number;
    notionalUSD: number;
    primeBrokerDesk: string;
    legA: SettlementLegDTO;
    legB: SettlementLegDTO;
    isISDACovered: boolean;
    createdAt: string;
    constructor(data: Partial<EnterpriseTreasuryFXModel>);
    toJSON(): {
        swapId: string;
        baseCurrency: string;
        quoteCurrency: string;
        spotRate: number;
        forwardPoints: number;
        notionalUSD: number;
        primeBrokerDesk: string;
        legA: SettlementLegDTO;
        legB: SettlementLegDTO;
        isISDACovered: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=EnterpriseTreasuryFXModel.d.ts.map