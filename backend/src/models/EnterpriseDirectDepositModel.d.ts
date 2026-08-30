export interface BankAccount {
    id: string;
    employeeName: string;
    employeeId: string;
    bankName: string;
    accountType: 'checking' | 'savings';
    routingNumberMasked: string;
    accountNumberMasked: string;
    splitType: 'percentage' | 'fixed-amount' | 'remainder';
    splitValue: number;
    verificationStatus: 'verified' | 'micro-deposit-pending' | 'rejected';
    priorityOrder: number;
    isPrimary: boolean;
}
export interface DirectDepositTransaction {
    id: string;
    accountId: string;
    employeeName: string;
    bankName: string;
    amountTransferred: number;
    nachaBatchId: string;
    payPeriod: string;
    status: 'settled' | 'processing' | 'returned';
    transferredDate: string;
}
export interface DirectDepositFilterOptions {
    bankName: string;
    accountType: string;
    verificationStatus: string;
    searchQuery: string;
}
export declare class EnterpriseDirectDepositService {
    private static accounts;
    private static transactions;
    static getAccounts(options?: Partial<DirectDepositFilterOptions>): BankAccount[];
    static getAccountById(id: string): BankAccount | undefined;
    static addBankAccount(account: Omit<BankAccount, "id" | "verificationStatus">): BankAccount;
    static getTransactions(): DirectDepositTransaction[];
    static triggerPayrollDirectDeposit(accountId: string, amountTransferred: number, payPeriod: string): DirectDepositTransaction;
}
//# sourceMappingURL=EnterpriseDirectDepositModel.d.ts.map