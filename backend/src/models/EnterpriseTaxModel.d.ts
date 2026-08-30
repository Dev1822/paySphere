export interface TaxBracket {
    id: string;
    jurisdiction: string;
    taxType: 'federal' | 'state' | 'local' | 'social-security' | 'medicare';
    filingStatus: 'single' | 'married-joint' | 'head-of-household';
    effectiveYear: number;
    ratePercentage: number;
    minIncome: number;
    maxIncome: number;
    description: string;
}
export interface TaxFilingRecord {
    id: string;
    employeeName: string;
    employeeId: string;
    stateJurisdiction: string;
    w4FilingStatus: 'single' | 'married-joint' | 'head-of-household';
    grossPay: number;
    federalTaxWithheld: number;
    stateTaxWithheld: number;
    ficaTaxWithheld: number;
    netPay: number;
    payPeriod: string;
    status: 'processed' | 'pending' | 'adjusted';
}
export interface TaxFilterOptions {
    jurisdiction: string;
    taxType: string;
    filingStatus: string;
    searchQuery: string;
}
export declare class EnterpriseTaxService {
    private static brackets;
    private static records;
    static getBrackets(options?: Partial<TaxFilterOptions>): TaxBracket[];
    static getBracketById(id: string): TaxBracket | undefined;
    static createTaxBracket(bracket: Omit<TaxBracket, "id">): TaxBracket;
    static getTaxRecords(): TaxFilingRecord[];
    static calculateAndProcessTaxWithholding(employeeName: string, employeeId: string, stateJurisdiction: string, w4FilingStatus: 'single' | 'married-joint' | 'head-of-household', grossPay: number, payPeriod: string): TaxFilingRecord;
}
//# sourceMappingURL=EnterpriseTaxModel.d.ts.map