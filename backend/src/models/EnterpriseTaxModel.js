"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseTaxService = void 0;
const INITIAL_TAX_BRACKETS = [
    {
        id: "tax-101",
        jurisdiction: "Federal (IRS)",
        taxType: "federal",
        filingStatus: "single",
        effectiveYear: 2026,
        ratePercentage: 22,
        minIncome: 47150,
        maxIncome: 100525,
        description: "Federal Income Tax Withholding 22% bracket for single W-4 filers.",
    },
    {
        id: "tax-102",
        jurisdiction: "Federal (IRS)",
        taxType: "social-security",
        filingStatus: "single",
        effectiveYear: 2026,
        ratePercentage: 6.2,
        minIncome: 0,
        maxIncome: 168600,
        description: "FICA Social Security Tax Withholding up to wage base limit.",
    },
    {
        id: "tax-103",
        jurisdiction: "Federal (IRS)",
        taxType: "medicare",
        filingStatus: "single",
        effectiveYear: 2026,
        ratePercentage: 1.45,
        minIncome: 0,
        maxIncome: 200000,
        description: "FICA Medicare Tax Withholding standard rate.",
    },
    {
        id: "tax-104",
        jurisdiction: "California (FTB)",
        taxType: "state",
        filingStatus: "single",
        effectiveYear: 2026,
        ratePercentage: 9.3,
        minIncome: 66295,
        maxIncome: 338639,
        description: "California State Income Tax Bracket for full-time resident employees.",
    },
];
const INITIAL_TAX_RECORDS = [
    {
        id: "tr-201",
        employeeName: "Alex Mercer",
        employeeId: "EMP-4091",
        stateJurisdiction: "California",
        w4FilingStatus: "single",
        grossPay: 10000,
        federalTaxWithheld: 2200,
        stateTaxWithheld: 930,
        ficaTaxWithheld: 765,
        netPay: 6105,
        payPeriod: "Aug 1 - Aug 15, 2026",
        status: "processed",
    },
];
class EnterpriseTaxService {
    static brackets = [...INITIAL_TAX_BRACKETS];
    static records = [...INITIAL_TAX_RECORDS];
    static getBrackets(options) {
        let result = [...this.brackets];
        if (!options)
            return result;
        if (options.jurisdiction && options.jurisdiction !== "All") {
            result = result.filter((b) => b.jurisdiction === options.jurisdiction);
        }
        if (options.taxType && options.taxType !== "All") {
            result = result.filter((b) => b.taxType === options.taxType);
        }
        if (options.filingStatus && options.filingStatus !== "All") {
            result = result.filter((b) => b.filingStatus === options.filingStatus);
        }
        if (options.searchQuery && options.searchQuery.trim() !== "") {
            const q = options.searchQuery.toLowerCase().trim();
            result = result.filter((b) => b.jurisdiction.toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q));
        }
        return result;
    }
    static getBracketById(id) {
        return this.brackets.find((b) => b.id === id);
    }
    static createTaxBracket(bracket) {
        const newBracket = {
            ...bracket,
            id: `tax-${Date.now()}`,
        };
        this.brackets.unshift(newBracket);
        return newBracket;
    }
    static getTaxRecords() {
        return [...this.records];
    }
    static calculateAndProcessTaxWithholding(employeeName, employeeId, stateJurisdiction, w4FilingStatus, grossPay, payPeriod) {
        const federalRate = 0.22;
        const stateRate = stateJurisdiction === 'California' ? 0.093 : 0.05;
        const ficaRate = 0.0765;
        const federalTaxWithheld = Math.round(grossPay * federalRate);
        const stateTaxWithheld = Math.round(grossPay * stateRate);
        const ficaTaxWithheld = Math.round(grossPay * ficaRate);
        const netPay = grossPay - (federalTaxWithheld + stateTaxWithheld + ficaTaxWithheld);
        const newRecord = {
            id: `tr-${Date.now()}`,
            employeeName,
            employeeId,
            stateJurisdiction,
            w4FilingStatus,
            grossPay,
            federalTaxWithheld,
            stateTaxWithheld,
            ficaTaxWithheld,
            netPay,
            payPeriod,
            status: 'processed',
        };
        this.records.unshift(newRecord);
        return newRecord;
    }
}
exports.EnterpriseTaxService = EnterpriseTaxService;
//# sourceMappingURL=EnterpriseTaxModel.js.map