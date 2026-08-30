"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseGarnishmentServiceHandler = void 0;
const EnterpriseGarnishmentModel_1 = require("../models/EnterpriseGarnishmentModel");
class EnterpriseGarnishmentServiceHandler {
    static fetchGarnishmentOrders(filters) {
        return EnterpriseGarnishmentModel_1.EnterpriseGarnishmentService.getOrders(filters);
    }
    static fetchOrderDetails(id) {
        return EnterpriseGarnishmentModel_1.EnterpriseGarnishmentService.getOrderById(id);
    }
    static createNewGarnishmentOrder(payload) {
        return EnterpriseGarnishmentModel_1.EnterpriseGarnishmentService.createOrder(payload);
    }
    static fetchDeductionHistory() {
        return EnterpriseGarnishmentModel_1.EnterpriseGarnishmentService.getDeductions();
    }
    static processOrderDeduction(orderId, amountDeducted, payPeriod) {
        return EnterpriseGarnishmentModel_1.EnterpriseGarnishmentService.processGarnishmentDeduction(orderId, amountDeducted, payPeriod);
    }
}
exports.EnterpriseGarnishmentServiceHandler = EnterpriseGarnishmentServiceHandler;
//# sourceMappingURL=EnterpriseGarnishmentService.js.map