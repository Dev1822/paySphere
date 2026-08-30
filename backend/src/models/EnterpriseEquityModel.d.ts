export interface VestingTrancheDTO {
    trancheId: string;
    vestDate: string;
    shareQuantity: number;
    isVested: boolean;
}
export declare class EnterpriseEquityModel {
    grantId: string;
    granteeId: string;
    granteeName: string;
    grantType: 'ISO' | 'NSO' | 'RSU';
    totalSharesGranted: number;
    strikePriceUSD: number;
    fairMarketValueUSD: number;
    cliffDurationMonths: number;
    totalVestingMonths: number;
    tranches: VestingTrancheDTO[];
    isApprovedByBoard: boolean;
    createdAt: string;
    constructor(data: Partial<EnterpriseEquityModel>);
    toJSON(): {
        grantId: string;
        granteeId: string;
        granteeName: string;
        grantType: "ISO" | "NSO" | "RSU";
        totalSharesGranted: number;
        strikePriceUSD: number;
        fairMarketValueUSD: number;
        cliffDurationMonths: number;
        totalVestingMonths: number;
        tranches: VestingTrancheDTO[];
        isApprovedByBoard: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=EnterpriseEquityModel.d.ts.map