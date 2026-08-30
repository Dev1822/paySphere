"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseContractorServiceHandler = void 0;
const EnterpriseContractorModel_1 = require("../models/EnterpriseContractorModel");
class EnterpriseContractorServiceHandler {
    static fetchContractors(filters) {
        return EnterpriseContractorModel_1.EnterpriseContractorService.getContractors(filters);
    }
    static fetchContractorDetails(id) {
        return EnterpriseContractorModel_1.EnterpriseContractorService.getContractorById(id);
    }
    static onboardNewContractor(payload) {
        return EnterpriseContractorModel_1.EnterpriseContractorService.onboardContractor(payload);
    }
    static fetchContractorPayouts() {
        return EnterpriseContractorModel_1.EnterpriseContractorService.getPayoutHistory();
    }
    static executeContractorPayout(contractorId, invoiceNumber, amount) {
        return EnterpriseContractorModel_1.EnterpriseContractorService.processInvoicePayout(contractorId, invoiceNumber, amount);
    }
}
exports.EnterpriseContractorServiceHandler = EnterpriseContractorServiceHandler;
//# sourceMappingURL=EnterpriseContractorService.js.map