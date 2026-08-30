export interface W8BENAuditDetails {
    formId: string;
    taxIdentityNumber: string;
    countryOfResidence: string;
    isVerified: boolean;
    expiresAt: string;
}
export declare class ContractorPayoutModel {
    contractorId: string;
    fullName: string;
    professionalTitle: string;
    residencyCountry: string;
    hourlyRateUSD: number;
    hoursBilled: number;
    totalGrossInvoiceUSD: number;
    taxAudit: W8BENAuditDetails;
    payoutGateway: string;
    status: 'SCHEDULED' | 'PROCESSING' | 'PAID' | 'FAILED';
    createdAt: string;
    constructor(data: Partial<ContractorPayoutModel>);
    toJSON(): {
        contractorId: string;
        fullName: string;
        professionalTitle: string;
        residencyCountry: string;
        hourlyRateUSD: number;
        hoursBilled: number;
        totalGrossInvoiceUSD: number;
        taxAudit: W8BENAuditDetails;
        payoutGateway: string;
        status: "FAILED" | "PAID" | "PROCESSING" | "SCHEDULED";
        createdAt: string;
    };
}
//# sourceMappingURL=ContractorDisbursementModel.d.ts.map