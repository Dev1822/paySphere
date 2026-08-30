"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseContractorService = void 0;
const INITIAL_CONTRACTORS = [
    {
        id: "contractor-101",
        contractorName: "Liam O'Connor",
        taxIdOrEin: "W8BEN-IE-90124",
        country: "Ireland",
        currency: "EUR",
        taxFormType: "W-8BEN",
        taxFormStatus: "verified",
        hourlyRateOrRetainer: 85,
        paymentMethod: "SEPA",
        contractTitle: "Senior Frontend React Architect",
        status: "active",
        onboardedDate: "Jan 10, 2026",
    },
    {
        id: "contractor-102",
        contractorName: "Apex Cloud Innovations LLC",
        taxIdOrEin: "98-4412091",
        country: "United States",
        currency: "USD",
        taxFormType: "W-9",
        taxFormStatus: "verified",
        hourlyRateOrRetainer: 125,
        paymentMethod: "ACH",
        contractTitle: "DevOps & Kubernetes Infrastructure Consulting",
        status: "active",
        onboardedDate: "Feb 01, 2026",
    },
    {
        id: "contractor-103",
        contractorName: "Aarav Sharma",
        taxIdOrEin: "PAN-ABCDE1234F",
        country: "India",
        currency: "INR",
        taxFormType: "W-8BEN",
        taxFormStatus: "pending-review",
        hourlyRateOrRetainer: 45,
        paymentMethod: "Wise",
        contractTitle: "Full-Stack Node.js Engineer",
        status: "onboarding",
        onboardedDate: "Aug 12, 2026",
    },
];
const INITIAL_PAYOUTS = [
    {
        id: "payout-201",
        contractorId: "contractor-101",
        contractorName: "Liam O'Connor",
        invoiceNumber: "INV-2026-081",
        amount: 6800,
        currency: "EUR",
        payoutDate: "Aug 15, 2026",
        taxWithheld: 0,
        netPayoutAmount: 6800,
        status: "completed",
    },
];
class EnterpriseContractorService {
    static contractors = [...INITIAL_CONTRACTORS];
    static payouts = [...INITIAL_PAYOUTS];
    static getContractors(options) {
        let result = [...this.contractors];
        if (!options)
            return result;
        if (options.country && options.country !== "All") {
            result = result.filter((c) => c.country === options.country);
        }
        if (options.taxFormType && options.taxFormType !== "All") {
            result = result.filter((c) => c.taxFormType === options.taxFormType);
        }
        if (options.taxFormStatus && options.taxFormStatus !== "All") {
            result = result.filter((c) => c.taxFormStatus === options.taxFormStatus);
        }
        if (options.searchQuery && options.searchQuery.trim() !== "") {
            const q = options.searchQuery.toLowerCase().trim();
            result = result.filter((c) => c.contractorName.toLowerCase().includes(q) ||
                c.contractTitle.toLowerCase().includes(q) ||
                c.taxIdOrEin.toLowerCase().includes(q));
        }
        return result;
    }
    static getContractorById(id) {
        return this.contractors.find((c) => c.id === id);
    }
    static onboardContractor(profile) {
        const newProfile = {
            ...profile,
            id: `contractor-${Date.now()}`,
            status: "active",
            onboardedDate: "Just now",
        };
        this.contractors.unshift(newProfile);
        return newProfile;
    }
    static getPayoutHistory() {
        return [...this.payouts];
    }
    static processInvoicePayout(contractorId, invoiceNumber, amount) {
        const contractor = this.getContractorById(contractorId);
        if (!contractor)
            throw new Error("Contractor profile not found.");
        const taxWithheld = contractor.taxFormStatus !== 'verified' ? Math.round(amount * 0.3) : 0;
        const netPayoutAmount = amount - taxWithheld;
        const newPayout = {
            id: `payout-${Date.now()}`,
            contractorId,
            contractorName: contractor.contractorName,
            invoiceNumber,
            amount,
            currency: contractor.currency,
            payoutDate: "Just now",
            taxWithheld,
            netPayoutAmount,
            status: contractor.taxFormStatus !== 'verified' ? 'held-for-tax-form' : 'completed',
        };
        this.payouts.unshift(newPayout);
        return newPayout;
    }
}
exports.EnterpriseContractorService = EnterpriseContractorService;
//# sourceMappingURL=EnterpriseContractorModel.js.map