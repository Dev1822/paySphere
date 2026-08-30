"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseDirectDepositServiceHandler = void 0;
const EnterpriseDirectDepositModel_1 = require("../models/EnterpriseDirectDepositModel");
class EnterpriseDirectDepositServiceHandler {
    static fetchBankAccounts(filters) {
        return EnterpriseDirectDepositModel_1.EnterpriseDirectDepositService.getAccounts(filters);
    }
    static fetchAccountDetails(id) {
        return EnterpriseDirectDepositModel_1.EnterpriseDirectDepositService.getAccountById(id);
    }
    static registerNewBankAccount(payload) {
        return EnterpriseDirectDepositModel_1.EnterpriseDirectDepositService.addBankAccount(payload);
    }
    static fetchDirectDepositTransactions() {
        return EnterpriseDirectDepositModel_1.EnterpriseDirectDepositService.getTransactions();
    }
    static processDirectDepositTransfer(accountId, amountTransferred, payPeriod) {
        return EnterpriseDirectDepositModel_1.EnterpriseDirectDepositService.triggerPayrollDirectDeposit(accountId, amountTransferred, payPeriod);
    }
}
exports.EnterpriseDirectDepositServiceHandler = EnterpriseDirectDepositServiceHandler;
//# sourceMappingURL=EnterpriseDirectDepositService.js.map