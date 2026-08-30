import { BankAccount, DirectDepositTransaction, DirectDepositFilterOptions } from "../models/EnterpriseDirectDepositModel";
export declare class EnterpriseDirectDepositServiceHandler {
    static fetchBankAccounts(filters?: Partial<DirectDepositFilterOptions>): BankAccount[];
    static fetchAccountDetails(id: string): BankAccount | undefined;
    static registerNewBankAccount(payload: Omit<BankAccount, "id" | "verificationStatus">): BankAccount;
    static fetchDirectDepositTransactions(): DirectDepositTransaction[];
    static processDirectDepositTransfer(accountId: string, amountTransferred: number, payPeriod: string): DirectDepositTransaction;
}
//# sourceMappingURL=EnterpriseDirectDepositService.d.ts.map