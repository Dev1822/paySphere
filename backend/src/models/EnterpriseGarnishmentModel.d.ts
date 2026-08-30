export interface GarnishmentOrder {
    id: string;
    employeeName: string;
    employeeId: string;
    garnishmentType: 'child-support' | 'tax-levy' | 'student-loan' | 'creditor-judgement';
    issuingAgency: string;
    caseNumber: string;
    totalOrderAmount: number;
    monthlyDeductionCap: number;
    priorityLevel: number;
    status: 'active' | 'fulfilled' | 'suspended';
    issuedDate: string;
    notes: string;
}
export interface GarnishmentDeduction {
    id: string;
    orderId: string;
    caseNumber: string;
    employeeName: string;
    amountDeducted: number;
    disbursementAgency: string;
    payPeriod: string;
    status: 'disbursed' | 'pending-disbursement' | 'held';
    processedDate: string;
}
export interface GarnishmentFilterOptions {
    garnishmentType: string;
    status: string;
    searchQuery: string;
}
export declare class EnterpriseGarnishmentService {
    private static orders;
    private static deductions;
    static getOrders(options?: Partial<GarnishmentFilterOptions>): GarnishmentOrder[];
    static getOrderById(id: string): GarnishmentOrder | undefined;
    static createOrder(order: Omit<GarnishmentOrder, "id" | "status">): GarnishmentOrder;
    static getDeductions(): GarnishmentDeduction[];
    static processGarnishmentDeduction(orderId: string, amountDeducted: number, payPeriod: string): GarnishmentDeduction;
}
//# sourceMappingURL=EnterpriseGarnishmentModel.d.ts.map