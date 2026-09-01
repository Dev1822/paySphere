"use strict";
// Enterprise Vendor Management & Procurement Suite — Data Models
// Covers vendor lifecycle, purchase orders, invoice processing, and contract intelligence
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockVendors = createMockVendors;
exports.createMockPurchaseOrders = createMockPurchaseOrders;
exports.createMockInvoices = createMockInvoices;
exports.createMockContracts = createMockContracts;
exports.computeVendorSpendByCategory = computeVendorSpendByCategory;
exports.computeRiskSummary = computeRiskSummary;
// Factory: generates realistic mock vendors across global procurement categories
function createMockVendors() {
    const vendors = [
        {
            id: 'VEN-001', name: 'TechNova Solutions', legalEntity: 'TechNova Inc.', taxId: 'TN-48291-US',
            status: 'active', tier: 'platinum', category: 'it_hardware',
            primaryContact: { name: 'Sarah Chen', email: 'sarah@technova.io', phone: '+1-415-555-0192' },
            address: { street: '1200 Innovation Dr', city: 'San Jose', state: 'CA', country: 'US', zip: '95134' },
            paymentTerms: 'Net 30', currency: 'USD', riskScore: 12, totalSpendYTD: 2450000,
            averageDeliveryDays: 5, complianceFlags: [], certifications: ['ISO 27001', 'SOC 2 Type II'],
            onboardedAt: '2021-03-15', lastAuditAt: '2026-01-10', createdAt: '2021-03-15T00:00:00Z',
        },
        {
            id: 'VEN-002', name: 'CloudPeak Systems', legalEntity: 'CloudPeak GmbH', taxId: 'CP-78123-DE',
            status: 'active', tier: 'gold', category: 'software',
            primaryContact: { name: 'Marcus Weber', email: 'marcus@cloudpeak.de', phone: '+49-30-555-0147' },
            address: { street: '45 Friedrichstr', city: 'Berlin', state: 'BE', country: 'DE', zip: '10117' },
            paymentTerms: 'Net 45', currency: 'EUR', riskScore: 18, totalSpendYTD: 890000,
            averageDeliveryDays: 2, complianceFlags: ['GDPR review pending'], certifications: ['ISO 27001'],
            onboardedAt: '2023-06-20', lastAuditAt: '2025-11-05', createdAt: '2023-06-20T00:00:00Z',
        },
        {
            id: 'VEN-003', name: 'Meridian Consulting Group', legalEntity: 'Meridian Consulting Ltd.', taxId: 'MC-33456-GB',
            status: 'active', tier: 'silver', category: 'consulting',
            primaryContact: { name: 'James Hartley', email: 'james@meridiancg.co.uk', phone: '+44-20-555-0183' },
            address: { street: '88 Canary Wharf', city: 'London', state: 'England', country: 'GB', zip: 'E14 5AB' },
            paymentTerms: 'Net 60', currency: 'GBP', riskScore: 25, totalSpendYTD: 670000,
            averageDeliveryDays: 14, complianceFlags: [], certifications: ['ISO 9001', 'CIPS'],
            onboardedAt: '2022-09-01', lastAuditAt: '2025-08-22', createdAt: '2022-09-01T00:00:00Z',
        },
        {
            id: 'VEN-004', name: 'Sakura IT Services', legalEntity: 'Sakura IT K.K.', taxId: 'SI-91234-JP',
            status: 'under_review', tier: 'bronze', category: 'it_hardware',
            primaryContact: { name: 'Yuki Tanaka', email: 'yuki@sakura-it.jp', phone: '+81-3-555-0271' },
            address: { street: '3-7-1 Nishi-Shinjuku', city: 'Tokyo', state: 'Tokyo', country: 'JP', zip: '160-0023' },
            paymentTerms: 'Net 30', currency: 'JPY', riskScore: 42, totalSpendYTD: 340000,
            averageDeliveryDays: 8, complianceFlags: ['Security questionnaire outstanding'], certifications: [],
            onboardedAt: '2025-01-10', lastAuditAt: null, createdAt: '2025-01-10T00:00:00Z',
        },
        {
            id: 'VEN-005', name: 'Apex Facility Services', legalEntity: 'Apex Facilities Pty Ltd', taxId: 'AF-56789-AU',
            status: 'active', tier: 'gold', category: 'facilities',
            primaryContact: { name: 'Liam O\'Brien', email: 'liam@apexfs.com.au', phone: '+61-2-555-0194' },
            address: { street: '200 George St', city: 'Sydney', state: 'NSW', country: 'AU', zip: '2000' },
            paymentTerms: 'Net 30', currency: 'AUD', riskScore: 15, totalSpendYTD: 520000,
            averageDeliveryDays: 3, complianceFlags: [], certifications: ['ISO 14001', 'OHSAS 18001'],
            onboardedAt: '2022-04-12', lastAuditAt: '2026-03-01', createdAt: '2022-04-12T00:00:00Z',
        },
        {
            id: 'VEN-006', name: 'Nordic Logistics AB', legalEntity: 'Nordic Logistics AB', taxId: 'NL-22345-SE',
            status: 'active', tier: 'platinum', category: 'logistics',
            primaryContact: { name: 'Erik Lindqvist', email: 'erik@nordiclog.se', phone: '+46-8-555-0136' },
            address: { street: '12 Kungsgatan', city: 'Stockholm', state: 'Stockholm', country: 'SE', zip: '111 43' },
            paymentTerms: 'Net 45', currency: 'SEK', riskScore: 10, totalSpendYTD: 1870000,
            averageDeliveryDays: 2, complianceFlags: [], certifications: ['ISO 9001', 'AEO Certified'],
            onboardedAt: '2020-11-08', lastAuditAt: '2026-02-15', createdAt: '2020-11-08T00:00:00Z',
        },
    ];
    return vendors;
}
// Factory: generates realistic purchase orders
function createMockPurchaseOrders() {
    return [
        {
            id: 'PO-1001', poNumber: 'PO-2026-1001', vendorId: 'VEN-001', vendorName: 'TechNova Solutions',
            status: 'approved', items: [
                { description: 'MacBook Pro 16" M4', quantity: 25, unitPrice: 2499, total: 62475, category: 'it_hardware' },
                { description: 'Dell UltraSharp 32" Monitor', quantity: 25, unitPrice: 899, total: 22475, category: 'it_hardware' },
            ],
            subtotal: 84950, tax: 7645.50, total: 92595.50, currency: 'USD',
            requestedBy: 'David Kim', approvedBy: 'CFO Office', requestedAt: '2026-08-01T09:00:00Z',
            approvedAt: '2026-08-02T14:30:00Z', expectedDelivery: '2026-08-15', deliveredAt: null,
            shippingAddress: '100 Tech Park, San Jose, CA 95134', notes: 'Q3 employee onboarding batch',
        },
        {
            id: 'PO-1002', poNumber: 'PO-2026-1002', vendorId: 'VEN-002', vendorName: 'CloudPeak Systems',
            status: 'sent', items: [
                { description: 'CloudPeak Enterprise License (100 seats)', quantity: 1, unitPrice: 120000, total: 120000, category: 'software' },
            ],
            subtotal: 120000, tax: 22800, total: 142800, currency: 'EUR',
            requestedBy: 'Anna Petrova', approvedBy: 'VP Engineering', requestedAt: '2026-07-20T11:00:00Z',
            approvedAt: '2026-07-21T09:15:00Z', expectedDelivery: '2026-08-30', deliveredAt: null,
            shippingAddress: 'N/A — Digital Delivery', notes: 'Annual platform renewal + 20 new seats',
        },
        {
            id: 'PO-1003', poNumber: 'PO-2026-1003', vendorId: 'VEN-005', vendorName: 'Apex Facility Services',
            status: 'received', items: [
                { description: 'Q3 Office Deep Clean Service', quantity: 1, unitPrice: 18500, total: 18500, category: 'facilities' },
                { description: 'HVAC Maintenance Contract (Quarterly)', quantity: 1, unitPrice: 12000, total: 12000, category: 'facilities' },
            ],
            subtotal: 30500, tax: 3050, total: 33550, currency: 'AUD',
            requestedBy: 'Facilities Team', approvedBy: 'Operations Director', requestedAt: '2026-07-01T08:00:00Z',
            approvedAt: '2026-07-02T10:00:00Z', expectedDelivery: '2026-07-25', deliveredAt: '2026-07-23T16:00:00Z',
            shippingAddress: '200 George St, Sydney NSW 2000', notes: 'Completed ahead of schedule',
        },
        {
            id: 'PO-1004', poNumber: 'PO-2026-1004', vendorId: 'VEN-006', vendorName: 'Nordic Logistics AB',
            status: 'pending_approval', items: [
                { description: 'Cross-border Shipping (Stockholm → NYC)', quantity: 3, unitPrice: 8500, total: 25500, category: 'logistics' },
                { description: 'Customs Clearance & Documentation', quantity: 3, unitPrice: 1200, total: 3600, category: 'logistics' },
            ],
            subtotal: 29100, tax: 0, total: 29100, currency: 'SEK',
            requestedBy: 'Supply Chain Team', approvedBy: null, requestedAt: '2026-08-10T13:00:00Z',
            approvedAt: null, expectedDelivery: '2026-09-05', deliveredAt: null,
            shippingAddress: 'Stockholm Warehouse → NYC HQ', notes: 'Urgent: Q4 marketing materials shipment',
        },
    ];
}
// Factory: generates realistic invoices
function createMockInvoices() {
    return [
        {
            id: 'INV-5001', invoiceNumber: 'TN-INV-2026-0891', vendorId: 'VEN-001', vendorName: 'TechNova Solutions',
            poId: null, poNumber: null, status: 'paid', amount: 84950, currency: 'USD', taxAmount: 7645.50,
            totalAmount: 92595.50, dueDate: '2026-08-30', receivedAt: '2026-08-05T10:00:00Z',
            matchedAt: '2026-08-05T14:22:00Z', paidAt: '2026-08-12T09:00:00Z', discrepancyNotes: null,
            threeWayMatch: true, attachments: ['invoice_tn_0891.pdf'],
        },
        {
            id: 'INV-5002', invoiceNumber: 'CP-INV-2026-0234', vendorId: 'VEN-002', vendorName: 'CloudPeak Systems',
            poId: 'PO-1002', poNumber: 'PO-2026-1002', status: 'received', amount: 120000, currency: 'EUR',
            taxAmount: 22800, totalAmount: 142800, dueDate: '2026-09-15', receivedAt: '2026-08-08T08:30:00Z',
            matchedAt: null, paidAt: null, discrepancyNotes: null,
            threeWayMatch: false, attachments: ['cp_invoice_0234.pdf', 'cp_license_terms.pdf'],
        },
        {
            id: 'INV-5003', invoiceNumber: 'AF-INV-2026-0445', vendorId: 'VEN-005', vendorName: 'Apex Facility Services',
            poId: 'PO-1003', poNumber: 'PO-2026-1003', status: 'discrepancy', amount: 30500, currency: 'AUD',
            taxAmount: 3050, totalAmount: 33550, dueDate: '2026-08-25', receivedAt: '2026-07-28T11:00:00Z',
            matchedAt: null, paidAt: null, discrepancyNotes: 'HVAC line item +$1,200 vs PO — includes after-hours surcharge not in original quote',
            threeWayMatch: false, attachments: ['af_inv_0445.pdf', 'af_hvac_surcharge.pdf'],
        },
        {
            id: 'INV-5004', invoiceNumber: 'NL-INV-2026-1190', vendorId: 'VEN-006', vendorName: 'Nordic Logistics AB',
            poId: null, poNumber: null, status: 'overdue', amount: 29100, currency: 'SEK', taxAmount: 0,
            totalAmount: 29100, dueDate: '2026-08-01', receivedAt: '2026-07-15T14:00:00Z',
            matchedAt: null, paidAt: null, discrepancyNotes: 'Payment 18 days overdue — escalated to AP',
            threeWayMatch: false, attachments: ['nl_freight_1190.pdf'],
        },
    ];
}
// Factory: generates procurement contracts
function createMockContracts() {
    return [
        {
            id: 'CTR-2001', contractNumber: 'MSA-TN-2023', vendorId: 'VEN-001', vendorName: 'TechNova Solutions',
            title: 'Master Services Agreement — Hardware Supply', description: 'Enterprise hardware procurement for all global offices including laptops, monitors, docking stations, and peripherals.',
            status: 'active', category: 'it_hardware', value: 5000000, currency: 'USD',
            startDate: '2023-01-01', endDate: '2027-12-31', renewalTerms: 'Auto-renew 24 months unless 90-day notice',
            autoRenew: true, noticePeriodDays: 90,
            keyContacts: [{ name: 'Sarah Chen', role: 'Account Director', email: 'sarah@technova.io' }],
            clauses: ['Volume discount tiers', 'SLA: 5-day delivery guarantee', 'Annual price cap +3%'],
            riskRating: 'low', complianceStatus: 'compliant', createdAt: '2022-12-01T00:00:00Z',
        },
        {
            id: 'CTR-2002', contractNumber: 'SaaS-CP-2024', vendorId: 'VEN-002', vendorName: 'CloudPeak Systems',
            title: 'SaaS Platform License Agreement', description: 'CloudPeak enterprise platform for infrastructure monitoring and incident management across 5 regions.',
            status: 'expiring_30d', category: 'software', value: 840000, currency: 'EUR',
            startDate: '2024-09-01', endDate: '2026-08-31', renewalTerms: '30-day renewal window, 10% annual escalation cap',
            autoRenew: true, noticePeriodDays: 30,
            keyContacts: [{ name: 'Marcus Weber', role: 'VP Sales EMEA', email: 'marcus@cloudpeak.de' }],
            clauses: ['Data residency EU only', '99.95% uptime SLA', 'SOC 2 Type II required'],
            riskRating: 'high', complianceStatus: 'pending_review', createdAt: '2024-08-15T00:00:00Z',
        },
        {
            id: 'CTR-2003', contractNumber: 'LOG-NL-2022', vendorId: 'VEN-006', vendorName: 'Nordic Logistics AB',
            title: 'Global Logistics & Freight Partnership', description: 'End-to-end logistics for inter-office shipments, client deliveries, and equipment distribution across EMEA and APAC.',
            status: 'active', category: 'logistics', value: 3200000, currency: 'SEK',
            startDate: '2022-04-01', endDate: '2026-03-31', renewalTerms: 'Manual renewal with 60-day negotiation period',
            autoRenew: false, noticePeriodDays: 60,
            keyContacts: [{ name: 'Erik Lindqvist', role: 'Head of Key Accounts', email: 'erik@nordiclog.se' }],
            clauses: ['Guaranteed transit times by corridor', 'Carbon offset program included', 'Quarterly business reviews'],
            riskRating: 'low', complianceStatus: 'compliant', createdAt: '2022-03-15T00:00:00Z',
        },
    ];
}
// Aggregation: vendor spend by category
function computeVendorSpendByCategory(vendors) {
    const map = new Map();
    for (const v of vendors) {
        const existing = map.get(v.category) || { totalSpend: 0, vendorCount: 0 };
        map.set(v.category, { totalSpend: existing.totalSpend + v.totalSpendYTD, vendorCount: existing.vendorCount + 1 });
    }
    return Array.from(map.entries()).map(([category, data]) => ({ category, ...data }));
}
// Aggregation: risk summary
function computeRiskSummary(vendors) {
    const summary = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const v of vendors) {
        if (v.riskScore <= 15)
            summary.low++;
        else if (v.riskScore <= 30)
            summary.medium++;
        else if (v.riskScore <= 60)
            summary.high++;
        else
            summary.critical++;
    }
    return summary;
}
//# sourceMappingURL=EnterpriseVendorModel.js.map