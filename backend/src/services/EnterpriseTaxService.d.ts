import { TaxBracket, TaxFilingRecord, TaxFilterOptions } from "../models/EnterpriseTaxModel";
export declare class EnterpriseTaxServiceHandler {
    static fetchTaxBrackets(filters?: Partial<TaxFilterOptions>): TaxBracket[];
    static fetchTaxBracketDetails(id: string): TaxBracket | undefined;
    static createNewTaxBracket(payload: Omit<TaxBracket, "id">): TaxBracket;
    static fetchTaxFilingRecords(): TaxFilingRecord[];
    static processEmployeeTaxWithholding(employeeName: string, employeeId: string, stateJurisdiction: string, w4FilingStatus: 'single' | 'married-joint' | 'head-of-household', grossPay: number, payPeriod: string): TaxFilingRecord;
}
//# sourceMappingURL=EnterpriseTaxService.d.ts.map