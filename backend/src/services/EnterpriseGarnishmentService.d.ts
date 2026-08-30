import { GarnishmentOrder, GarnishmentDeduction, GarnishmentFilterOptions } from "../models/EnterpriseGarnishmentModel";
export declare class EnterpriseGarnishmentServiceHandler {
    static fetchGarnishmentOrders(filters?: Partial<GarnishmentFilterOptions>): GarnishmentOrder[];
    static fetchOrderDetails(id: string): GarnishmentOrder | undefined;
    static createNewGarnishmentOrder(payload: Omit<GarnishmentOrder, "id" | "status">): GarnishmentOrder;
    static fetchDeductionHistory(): GarnishmentDeduction[];
    static processOrderDeduction(orderId: string, amountDeducted: number, payPeriod: string): GarnishmentDeduction;
}
//# sourceMappingURL=EnterpriseGarnishmentService.d.ts.map