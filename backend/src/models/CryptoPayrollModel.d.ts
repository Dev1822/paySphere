export interface OnChainTxReceiptModel {
    txHash: string;
    chainNetwork: string;
    tokenSymbol: string;
    amountToken: number;
    recipientAddress: string;
    blockHeight: number;
    confirmedAt: string;
}
export declare class CryptoVaultWalletModel {
    walletId: string;
    chainNetwork: string;
    tokenSymbol: string;
    publicAddress: string;
    tokenBalance: number;
    usdValuation: number;
    isMultiSigSecured: boolean;
    recentReceipts: OnChainTxReceiptModel[];
    createdAt: string;
    constructor(data: Partial<CryptoVaultWalletModel>);
    toJSON(): {
        walletId: string;
        chainNetwork: string;
        tokenSymbol: string;
        publicAddress: string;
        tokenBalance: number;
        usdValuation: number;
        isMultiSigSecured: boolean;
        recentReceipts: OnChainTxReceiptModel[];
        createdAt: string;
    };
}
//# sourceMappingURL=CryptoPayrollModel.d.ts.map