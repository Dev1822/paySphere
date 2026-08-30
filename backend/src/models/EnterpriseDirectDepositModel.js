"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseDirectDepositService = void 0;
const INITIAL_BANK_ACCOUNTS = [
    {
        id: "bank-101",
        employeeName: "Alex Mercer",
        employeeId: "EMP-4091",
        bankName: "JPMorgan Chase Bank",
        accountType: "checking",
        routingNumberMasked: "*****0210",
        accountNumberMasked: "******8841",
        splitType: "percentage",
        splitValue: 80,
        verificationStatus: "verified",
        priorityOrder: 1,
        isPrimary: true,
    },
    {
        id: "bank-102",
        employeeName: "Alex Mercer",
        employeeId: "EMP-4091",
        bankName: "Fidelity High Yield Savings",
        accountType: "savings",
        routingNumberMasked: "*****4410",
        accountNumberMasked: "******1109",
        splitType: "remainder",
        splitValue: 20,
        verificationStatus: "verified",
        priorityOrder: 2,
        isPrimary: false,
    },
    {
        id: "bank-103",
        employeeName: "Elena Rostova",
        employeeId: "EMP-8841",
        bankName: "Bank of America",
        accountType: "checking",
        routingNumberMasked: "*****0032",
        accountNumberMasked: "******9923",
        splitType: "percentage",
        splitValue: 100,
        verificationStatus: "micro-deposit-pending",
        priorityOrder: 1,
        isPrimary: true,
    },
];
const INITIAL_TRANSACTIONS = [
    {
        id: "tx-201",
        accountId: "bank-101",
        employeeName: "Alex Mercer",
        bankName: "JPMorgan Chase Bank",
        amountTransferred: 4884,
        nachaBatchId: "NACHA-2026-0815-A",
        payPeriod: "Aug 1 - Aug 15, 2026",
        status: "settled",
        transferredDate: "Aug 15, 2026",
    },
];
class EnterpriseDirectDepositService {
    static accounts = [...INITIAL_BANK_ACCOUNTS];
    static transactions = [...INITIAL_TRANSACTIONS];
    static getAccounts(options) {
        let result = [...this.accounts];
        if (!options)
            return result;
        if (options.bankName && options.bankName !== "All") {
            result = result.filter((a) => a.bankName === options.bankName);
        }
        if (options.accountType && options.accountType !== "All") {
            result = result.filter((a) => a.accountType === options.accountType);
        }
        if (options.verificationStatus && options.verificationStatus !== "All") {
            result = result.filter((a) => a.verificationStatus === options.verificationStatus);
        }
        if (options.searchQuery && options.searchQuery.trim() !== "") {
            const q = options.searchQuery.toLowerCase().trim();
            result = result.filter((a) => a.employeeName.toLowerCase().includes(q) ||
                a.bankName.toLowerCase().includes(q) ||
                a.accountNumberMasked.toLowerCase().includes(q));
        }
        return result;
    }
    static getAccountById(id) {
        return this.accounts.find((a) => a.id === id);
    }
    static addBankAccount(account) {
        const newAccount = {
            ...account,
            id: `bank-${Date.now()}`,
            verificationStatus: "verified",
        };
        this.accounts.unshift(newAccount);
        return newAccount;
    }
    static getTransactions() {
        return [...this.transactions];
    }
    static triggerPayrollDirectDeposit(accountId, amountTransferred, payPeriod) {
        const account = this.getAccountById(accountId);
        if (!account)
            throw new Error("Bank account profile not found.");
        const newTransaction = {
            id: `tx-${Date.now()}`,
            accountId,
            employeeName: account.employeeName,
            bankName: account.bankName,
            amountTransferred,
            nachaBatchId: `NACHA-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            payPeriod,
            status: "settled",
            transferredDate: "Just now",
        };
        this.transactions.unshift(newTransaction);
        return newTransaction;
    }
}
exports.EnterpriseDirectDepositService = EnterpriseDirectDepositService;
//# sourceMappingURL=EnterpriseDirectDepositModel.js.map