export interface StatementLineItemDTO {
    lineItemId: string;
    transactionReference: string;
    amountUSD: number;
    isMatched: boolean;
}
export declare class EnterpriseReconciliationModel {
    batchId: string;
    batchName: string;
    bankPartner: string;
    clearingSystem: string;
    totalDisbursedUSD: number;
    matchedCount: number;
    discrepancyCount: number;
    varianceUSD: number;
    statementItems: StatementLineItemDTO[];
    isGLPosted: boolean;
    createdAt: string;
    constructor(data: Partial<EnterpriseReconciliationModel>);
    toJSON(): {
        batchId: string;
        batchName: string;
        bankPartner: string;
        clearingSystem: string;
        totalDisbursedUSD: number;
        matchedCount: number;
        discrepancyCount: number;
        varianceUSD: number;
        statementItems: StatementLineItemDTO[];
        isGLPosted: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=EnterpriseReconciliationModel.d.ts.map