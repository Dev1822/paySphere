export interface TaxFilingReceiptModel {
    filingId: string;
    formType: string;
    authorityName: string;
    taxAmountUSD: number;
    acknowledgmentCode: string;
    submittedAt: string;
}
export declare class TaxJurisdictionRuleModel {
    jurisdictionId: string;
    countryISO: string;
    regionName: string;
    corporateRatePercent: number;
    employerPayrollRatePercent: number;
    employeeWithholdingRatePercent: number;
    statutoryFilingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    filingReceipts: TaxFilingReceiptModel[];
    isCompliant: boolean;
    createdAt: string;
    constructor(data: Partial<TaxJurisdictionRuleModel>);
    toJSON(): {
        jurisdictionId: string;
        countryISO: string;
        regionName: string;
        corporateRatePercent: number;
        employerPayrollRatePercent: number;
        employeeWithholdingRatePercent: number;
        statutoryFilingFrequency: "ANNUAL" | "MONTHLY" | "QUARTERLY";
        filingReceipts: TaxFilingReceiptModel[];
        isCompliant: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=MultiJurisdictionTaxModel.d.ts.map