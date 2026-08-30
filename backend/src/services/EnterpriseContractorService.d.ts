import { ContractorProfile, ContractorPayout, ContractorFilterOptions } from "../models/EnterpriseContractorModel";
export declare class EnterpriseContractorServiceHandler {
    static fetchContractors(filters?: Partial<ContractorFilterOptions>): ContractorProfile[];
    static fetchContractorDetails(id: string): ContractorProfile | undefined;
    static onboardNewContractor(payload: Omit<ContractorProfile, "id" | "status" | "onboardedDate">): ContractorProfile;
    static fetchContractorPayouts(): ContractorPayout[];
    static executeContractorPayout(contractorId: string, invoiceNumber: string, amount: number): ContractorPayout;
}
//# sourceMappingURL=EnterpriseContractorService.d.ts.map