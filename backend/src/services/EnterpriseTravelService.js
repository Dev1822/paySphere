"use strict";
// Enterprise Travel & Expense Management Suite — Service Layer
// Express router exposing travel requests, expense reports, and per diem endpoints
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const EnterpriseTravelModel_1 = require("../models/EnterpriseTravelModel");
const router = (0, express_1.Router)();
const travelRequests = (0, EnterpriseTravelModel_1.createMockTravelRequests)();
const expenseReports = (0, EnterpriseTravelModel_1.createMockExpenseReports)();
const perDiemRates = (0, EnterpriseTravelModel_1.createMockPerDiemRates)();
// GET /api/travel/requests — list travel requests with optional filters
router.get('/requests', (req, res) => {
    let filtered = [...travelRequests];
    const { status, department, tripType, search } = req.query;
    if (status)
        filtered = filtered.filter((r) => r.status === status);
    if (department)
        filtered = filtered.filter((r) => r.department === department);
    if (tripType)
        filtered = filtered.filter((r) => r.tripType === tripType);
    if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter((r) => r.employeeName.toLowerCase().includes(q) || r.destination.city.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q));
    }
    res.json({ requests: filtered, total: filtered.length });
});
// GET /api/travel/requests/:id — single travel request detail
router.get('/requests/:id', (req, res) => {
    const request = travelRequests.find((r) => r.id === req.params.id);
    if (!request)
        return res.status(404).json({ error: 'Travel request not found' });
    const relatedExpense = expenseReports.find((e) => e.travelRequestId === request.id);
    res.json({ request, relatedExpense });
});
// GET /api/travel/expenses — list expense reports with optional filters
router.get('/expenses', (req, res) => {
    let filtered = [...expenseReports];
    const { status, department, search } = req.query;
    if (status)
        filtered = filtered.filter((e) => e.status === status);
    if (department)
        filtered = filtered.filter((e) => e.department === department);
    if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter((e) => e.employeeName.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
    }
    res.json({ expenses: filtered, total: filtered.length });
});
// GET /api/travel/expenses/:id — single expense report detail
router.get('/expenses/:id', (req, res) => {
    const expense = expenseReports.find((e) => e.id === req.params.id);
    if (!expense)
        return res.status(404).json({ error: 'Expense report not found' });
    res.json({ expense });
});
// GET /api/travel/per-diem — list per diem rates with optional location filter
router.get('/per-diem', (req, res) => {
    let filtered = [...perDiemRates];
    const { region, country } = req.query;
    if (region)
        filtered = filtered.filter((p) => p.region === region);
    if (country)
        filtered = filtered.filter((p) => p.country === country);
    res.json({ perDiemRates: filtered, total: filtered.length });
});
// GET /api/travel/analytics — aggregated travel intelligence
router.get('/analytics', (_req, res) => {
    const totalTrips = travelRequests.length;
    const totalSpend = travelRequests.reduce((s, r) => s + r.estimatedCost.total, 0);
    const averageTripCost = totalTrips > 0 ? Math.round(totalSpend / totalTrips) : 0;
    const topDestinations = (0, EnterpriseTravelModel_1.computeTopDestinations)(travelRequests);
    const departmentSpend = (0, EnterpriseTravelModel_1.computeDepartmentSpend)(travelRequests);
    const complianceRate = travelRequests.length > 0
        ? (travelRequests.filter((r) => r.complianceFlags.length === 0).length / travelRequests.length * 100).toFixed(1)
        : '0';
    const advanceBookingRate = travelRequests.length > 0
        ? (travelRequests.filter((r) => {
            const dep = new Date(r.departureDate);
            const created = new Date(r.createdAt);
            return (dep.getTime() - created.getTime()) / (1000 * 60 * 60 * 24) >= 14;
        }).length / travelRequests.length * 100).toFixed(1)
        : '0';
    const spendByCategory = [
        { category: 'airfare', amount: travelRequests.reduce((s, r) => s + r.estimatedCost.flights, 0) },
        { category: 'hotel', amount: travelRequests.reduce((s, r) => s + r.estimatedCost.hotel, 0) },
        { category: 'ground_transport', amount: travelRequests.reduce((s, r) => s + r.estimatedCost.ground, 0) },
        { category: 'meals', amount: travelRequests.reduce((s, r) => s + r.estimatedCost.meals, 0) },
    ].map((c) => ({ ...c, percentage: totalSpend > 0 ? Math.round((c.amount / totalSpend) * 100) : 0 }));
    const totalExpenseReportAmount = expenseReports.reduce((s, e) => s + e.totalAmount, 0);
    const pendingReimbursement = expenseReports.filter((e) => e.status === 'submitted' || e.status === 'under_review').reduce((s, e) => s + e.totalAmount, 0);
    res.json({
        totalTrips, totalSpend, averageTripCost, topDestinations, departmentSpend,
        complianceRate: Number(complianceRate), advanceBookingRate: Number(advanceBookingRate),
        policyViolations: travelRequests.filter((r) => r.complianceFlags.length > 0).length,
        spendByCategory, totalExpenseReportAmount, pendingReimbursement,
    });
});
// POST /api/travel/requests/:id/approve — approve a travel request
router.post('/requests/:id/approve', (req, res) => {
    const request = travelRequests.find((r) => r.id === req.params.id);
    if (!request)
        return res.status(404).json({ error: 'Travel request not found' });
    if (request.status !== 'pending_approval')
        return res.status(400).json({ error: 'Request is not pending approval' });
    request.status = 'approved';
    request.approvedBy = req.body.approver || 'Admin';
    request.approvedAt = new Date().toISOString();
    res.json({ request, message: 'Travel request approved' });
});
// POST /api/travel/expenses/:id/approve — approve an expense report
router.post('/expenses/:id/approve', (req, res) => {
    const expense = expenseReports.find((e) => e.id === req.params.id);
    if (!expense)
        return res.status(404).json({ error: 'Expense report not found' });
    if (expense.status !== 'submitted' && expense.status !== 'under_review') {
        return res.status(400).json({ error: 'Expense report is not in reviewable state' });
    }
    expense.status = 'approved';
    expense.reviewedBy = req.body.reviewer || 'Finance Ops';
    res.json({ expense, message: 'Expense report approved for reimbursement' });
});
exports.default = router;
//# sourceMappingURL=EnterpriseTravelService.js.map