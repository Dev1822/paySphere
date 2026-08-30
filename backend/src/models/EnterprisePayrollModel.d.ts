export interface TaxBreakdownModel {
    federalTaxUSD: number;
    stateTaxUSD: number;
    socialSecurityUSD: number;
    medicareUSD: number;
}
export declare class PayrollBatchDisbursementModel {
    batchId: string;
    departmentCode: string;
    headcount: number;
    totalGrossAmountUSD: number;
    taxes: TaxBreakdownModel;
    netAmountUSD: number;
    status: 'PENDING' | 'PROCESSING' | 'DISBURSED' | 'FAILED';
    processedAt: string;
    constructor(data: Partial<PayrollBatchDisbursementModel>);
    toJSON(): {
        batchId: string;
        departmentCode: string;
        headcount: number;
        totalGrossAmountUSD: number;
        taxes: TaxBreakdownModel;
        netAmountUSD: number;
        status: "DISBURSED" | "FAILED" | "PENDING" | "PROCESSING";
        processedAt: string;
    };
}
//# sourceMappingURL=EnterprisePayrollModel.d.ts.map