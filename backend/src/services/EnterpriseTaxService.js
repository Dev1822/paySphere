"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseTaxServiceHandler = void 0;
const EnterpriseTaxModel_1 = require("../models/EnterpriseTaxModel");
class EnterpriseTaxServiceHandler {
    static fetchTaxBrackets(filters) {
        return EnterpriseTaxModel_1.EnterpriseTaxService.getBrackets(filters);
    }
    static fetchTaxBracketDetails(id) {
        return EnterpriseTaxModel_1.EnterpriseTaxService.getBracketById(id);
    }
    static createNewTaxBracket(payload) {
        return EnterpriseTaxModel_1.EnterpriseTaxService.createTaxBracket(payload);
    }
    static fetchTaxFilingRecords() {
        return EnterpriseTaxModel_1.EnterpriseTaxService.getTaxRecords();
    }
    static processEmployeeTaxWithholding(employeeName, employeeId, stateJurisdiction, w4FilingStatus, grossPay, payPeriod) {
        return EnterpriseTaxModel_1.EnterpriseTaxService.calculateAndProcessTaxWithholding(employeeName, employeeId, stateJurisdiction, w4FilingStatus, grossPay, payPeriod);
    }
}
exports.EnterpriseTaxServiceHandler = EnterpriseTaxServiceHandler;
//# sourceMappingURL=EnterpriseTaxService.js.map