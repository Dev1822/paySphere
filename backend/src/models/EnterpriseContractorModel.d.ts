export interface ContractorProfile {
    id: string;
    contractorName: string;
    taxIdOrEin: string;
    country: string;
    currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'INR' | 'AUD';
    taxFormType: 'W-9' | 'W-8BEN' | 'W-8BEN-E';
    taxFormStatus: 'verified' | 'pending-review' | 'expired';
    hourlyRateOrRetainer: number;
    paymentMethod: 'SWIFT' | 'SEPA' | 'ACH' | 'Wise';
    contractTitle: string;
    status: 'active' | 'onboarding' | 'terminated';
    onboardedDate: string;
}
export interface ContractorPayout {
    id: string;
    contractorId: string;
    contractorName: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    payoutDate: string;
    taxWithheld: number;
    netPayoutAmount: number;
    status: 'completed' | 'processing' | 'held-for-tax-form';
}
export interface ContractorFilterOptions {
    country: string;
    taxFormType: string;
    taxFormStatus: string;
    searchQuery: string;
}
export declare class EnterpriseContractorService {
    private static contractors;
    private static payouts;
    static getContractors(options?: Partial<ContractorFilterOptions>): ContractorProfile[];
    static getContractorById(id: string): ContractorProfile | undefined;
    static onboardContractor(profile: Omit<ContractorProfile, "id" | "status" | "onboardedDate">): ContractorProfile;
    static getPayoutHistory(): ContractorPayout[];
    static processInvoicePayout(contractorId: string, invoiceNumber: string, amount: number): ContractorPayout;
}
//# sourceMappingURL=EnterpriseContractorModel.d.ts.map