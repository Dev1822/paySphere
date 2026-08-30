"use strict";
// Enterprise Vendor Management & Procurement Suite — Service Layer
// Express router exposing vendor, PO, invoice, and contract endpoints
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const EnterpriseVendorModel_1 = require("../models/EnterpriseVendorModel");
const router = (0, express_1.Router)();
const vendors = (0, EnterpriseVendorModel_1.createMockVendors)();
const purchaseOrders = (0, EnterpriseVendorModel_1.createMockPurchaseOrders)();
const invoices = (0, EnterpriseVendorModel_1.createMockInvoices)();
const contracts = (0, EnterpriseVendorModel_1.createMockContracts)();
// GET /api/vendor-management/vendors — list all vendors with optional filters
router.get('/vendors', (req, res) => {
    let filtered = [...vendors];
    const { status, tier, category, search } = req.query;
    if (status)
        filtered = filtered.filter((v) => v.status === status);
    if (tier)
        filtered = filtered.filter((v) => v.tier === tier);
    if (category)
        filtered = filtered.filter((v) => v.category === category);
    if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter((v) => v.name.toLowerCase().includes(q) || v.legalEntity.toLowerCase().includes(q));
    }
    res.json({ vendors: filtered, total: filtered.length });
});
// GET /api/vendor-management/vendors/:id — single vendor detail
router.get('/vendors/:id', (req, res) => {
    const vendor = vendors.find((v) => v.id === req.params.id);
    if (!vendor)
        return res.status(404).json({ error: 'Vendor not found' });
    const vendorPOs = purchaseOrders.filter((p) => p.vendorId === vendor.id);
    const vendorInvoices = invoices.filter((i) => i.vendorId === vendor.id);
    const vendorContract = contracts.find((c) => c.vendorId === vendor.id);
    res.json({ vendor, purchaseOrders: vendorPOs, invoices: vendorInvoices, contract: vendorContract });
});
// GET /api/vendor-management/purchase-orders — list POs with optional status filter
router.get('/purchase-orders', (req, res) => {
    let filtered = [...purchaseOrders];
    const { status } = req.query;
    if (status)
        filtered = filtered.filter((p) => p.status === status);
    res.json({ purchaseOrders: filtered, total: filtered.length });
});
// GET /api/vendor-management/invoices — list invoices with optional status filter
router.get('/invoices', (req, res) => {
    let filtered = [...invoices];
    const { status } = req.query;
    if (status)
        filtered = filtered.filter((i) => i.status === status);
    res.json({ invoices: filtered, total: filtered.length });
});
// GET /api/vendor-management/contracts — list contracts with optional status filter
router.get('/contracts', (req, res) => {
    let filtered = [...contracts];
    const { status } = req.query;
    if (status)
        filtered = filtered.filter((c) => c.status === status);
    res.json({ contracts: filtered, total: filtered.length });
});
// GET /api/vendor-management/analytics — aggregated procurement intelligence
router.get('/analytics', (_req, res) => {
    const totalVendorSpend = vendors.reduce((sum, v) => sum + v.totalSpendYTD, 0);
    const spendByCategory = (0, EnterpriseVendorModel_1.computeVendorSpendByCategory)(vendors);
    const riskSummary = (0, EnterpriseVendorModel_1.computeRiskSummary)(vendors);
    const openPOAmount = purchaseOrders
        .filter((p) => ['draft', 'pending_approval', 'approved', 'sent'].includes(p.status))
        .reduce((sum, p) => sum + p.total, 0);
    const overdueInvoiceAmount = invoices
        .filter((i) => i.status === 'overdue')
        .reduce((sum, i) => sum + i.totalAmount, 0);
    const pendingInvoiceAmount = invoices
        .filter((i) => ['received', 'matched', 'discrepancy'].includes(i.status))
        .reduce((sum, i) => sum + i.totalAmount, 0);
    const expiringContracts = contracts.filter((c) => c.status === 'expiring_30d' || c.status === 'expiring_90d');
    res.json({
        totalVendorSpend,
        activeVendorCount: vendors.filter((v) => v.status === 'active').length,
        totalVendors: vendors.length,
        spendByCategory,
        riskSummary,
        openPOAmount,
        overdueInvoiceAmount,
        pendingInvoiceAmount,
        expiringContracts: expiringContracts.length,
        contracts: expiringContracts,
        threeWayMatchRate: invoices.length > 0 ? (invoices.filter((i) => i.threeWayMatch).length / invoices.length * 100).toFixed(1) : '0',
    });
});
// POST /api/vendor-management/vendors/:id/risk-assessment — update vendor risk score
router.post('/vendors/:id/risk-assessment', (req, res) => {
    const vendor = vendors.find((v) => v.id === req.params.id);
    if (!vendor)
        return res.status(404).json({ error: 'Vendor not found' });
    const { riskScore, flags } = req.body;
    if (typeof riskScore === 'number')
        vendor.riskScore = riskScore;
    if (Array.isArray(flags))
        vendor.complianceFlags = flags;
    res.json({ vendor, message: 'Risk assessment updated' });
});
// POST /api/vendor-management/invoices/:id/approve — approve an invoice for payment
router.post('/invoices/:id/approve', (req, res) => {
    const invoice = invoices.find((i) => i.id === req.params.id);
    if (!invoice)
        return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid')
        return res.status(400).json({ error: 'Invoice already paid' });
    invoice.status = 'approved';
    invoice.matchedAt = new Date().toISOString();
    res.json({ invoice, message: 'Invoice approved for payment' });
});
exports.default = router;
//# sourceMappingURL=EnterpriseVendorService.js.map