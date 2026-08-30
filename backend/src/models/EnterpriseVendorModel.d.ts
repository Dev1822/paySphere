export type VendorStatus = 'active' | 'inactive' | 'pending' | 'blacklisted' | 'under_review';
export type VendorTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'unclassified';
export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'received' | 'closed' | 'cancelled';
export type InvoiceStatus = 'received' | 'matched' | 'discrepancy' | 'approved' | 'paid' | 'overdue';
export type ContractStatus = 'active' | 'expiring_30d' | 'expiring_90d' | 'expired' | 'renewal_pending';
export type ProcurementCategory = 'it_hardware' | 'software' | 'professional_services' | 'office_supplies' | 'logistics' | 'facilities' | 'consulting' | 'marketing';
export interface IVendor {
    id: string;
    name: string;
    legalEntity: string;
    taxId: string;
    status: VendorStatus;
    tier: VendorTier;
    category: ProcurementCategory;
    primaryContact: {
        name: string;
        email: string;
        phone: string;
    };
    address: {
        street: string;
        city: string;
        state: string;
        country: string;
        zip: string;
    };
    paymentTerms: string;
    currency: string;
    riskScore: number;
    totalSpendYTD: number;
    averageDeliveryDays: number;
    complianceFlags: string[];
    certifications: string[];
    onboardedAt: string;
    lastAuditAt: string | null;
    createdAt: string;
}
export interface IPurchaseOrder {
    id: string;
    poNumber: string;
    vendorId: string;
    vendorName: string;
    status: POStatus;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        category: ProcurementCategory;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    requestedBy: string;
    approvedBy: string | null;
    requestedAt: string;
    approvedAt: string | null;
    expectedDelivery: string;
    deliveredAt: string | null;
    shippingAddress: string;
    notes: string;
}
export interface IInvoice {
    id: string;
    invoiceNumber: string;
    vendorId: string;
    vendorName: string;
    poId: string | null;
    poNumber: string | null;
    status: InvoiceStatus;
    amount: number;
    currency: string;
    taxAmount: number;
    totalAmount: number;
    dueDate: string;
    receivedAt: string;
    matchedAt: string | null;
    paidAt: string | null;
    discrepancyNotes: string | null;
    threeWayMatch: boolean;
    attachments: string[];
}
export interface IProcurementContract {
    id: string;
    contractNumber: string;
    vendorId: string;
    vendorName: string;
    title: string;
    description: string;
    status: ContractStatus;
    category: ProcurementCategory;
    value: number;
    currency: string;
    startDate: string;
    endDate: string;
    renewalTerms: string;
    autoRenew: boolean;
    noticePeriodDays: number;
    keyContacts: Array<{
        name: string;
        role: string;
        email: string;
    }>;
    clauses: string[];
    riskRating: 'low' | 'medium' | 'high' | 'critical';
    complianceStatus: 'compliant' | 'pending_review' | 'non_compliant';
    createdAt: string;
}
export declare function createMockVendors(): IVendor[];
export declare function createMockPurchaseOrders(): IPurchaseOrder[];
export declare function createMockInvoices(): IInvoice[];
export declare function createMockContracts(): IProcurementContract[];
export declare function computeVendorSpendByCategory(vendors: IVendor[]): Array<{
    category: ProcurementCategory;
    totalSpend: number;
    vendorCount: number;
}>;
export declare function computeRiskSummary(vendors: IVendor[]): {
    low: number;
    medium: number;
    high: number;
    critical: number;
};
//# sourceMappingURL=EnterpriseVendorModel.d.ts.map