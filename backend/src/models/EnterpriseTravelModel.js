"use strict";
// Enterprise Travel & Expense Management Suite — Data Models
// Covers travel requests, expense reports, per diem rates, and travel compliance
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockTravelRequests = createMockTravelRequests;
exports.createMockExpenseReports = createMockExpenseReports;
exports.createMockPerDiemRates = createMockPerDiemRates;
exports.computeDepartmentSpend = computeDepartmentSpend;
exports.computeTopDestinations = computeTopDestinations;
// Factory: generates realistic travel requests
function createMockTravelRequests() {
    return [
        {
            id: 'TR-001', requestId: 'TRV-2026-001', employeeId: 'EMP-101', employeeName: 'Sarah Chen',
            department: 'Engineering', tripType: 'conference', purpose: 'AWS re:Invent 2026 — Attend keynote sessions and partner networking',
            destination: { city: 'Las Vegas', country: 'US', region: 'North America' },
            departureDate: '2026-12-01', returnDate: '2026-12-05',
            estimatedCost: { flights: 650, hotel: 1800, ground: 200, meals: 400, total: 3050 },
            status: 'approved', priority: 'standard', approvedBy: 'VP Engineering', approvedAt: '2026-08-10T14:00:00Z',
            bookingRef: 'AWS-REINVITE-2026-SC', complianceFlags: [], createdAt: '2026-08-01T09:00:00Z',
        },
        {
            id: 'TR-002', requestId: 'TRV-2026-002', employeeId: 'EMP-102', employeeName: 'Marcus Weber',
            department: 'Product', tripType: 'client_visit', purpose: 'Enterprise client demo — Meridian Group partnership expansion',
            destination: { city: 'London', country: 'GB', region: 'EMEA' },
            departureDate: '2026-09-15', returnDate: '2026-09-19',
            estimatedCost: { flights: 2200, hotel: 2400, ground: 350, meals: 500, total: 5450 },
            status: 'booked', priority: 'expedited', approvedBy: 'CRO', approvedAt: '2026-08-05T11:00:00Z',
            bookingRef: 'BA-7891-MW', complianceFlags: ['Hotel exceeds per diem by 15%'], createdAt: '2026-07-28T10:30:00Z',
        },
        {
            id: 'TR-003', requestId: 'TRV-2026-003', employeeId: 'EMP-103', employeeName: 'Priya Patel',
            department: 'Finance', tripType: 'training', purpose: 'CFA Level III study intensive — 2-week bootcamp',
            destination: { city: 'New York', country: 'US', region: 'North America' },
            departureDate: '2026-10-06', returnDate: '2026-10-17',
            estimatedCost: { flights: 450, hotel: 3200, ground: 150, meals: 800, total: 4600 },
            status: 'pending_approval', priority: 'standard', approvedBy: null, approvedAt: null,
            bookingRef: null, complianceFlags: ['Extended stay — 10+ business days'], createdAt: '2026-08-12T15:00:00Z',
        },
        {
            id: 'TR-004', requestId: 'TRV-2026-004', employeeId: 'EMP-104', employeeName: 'James Hartley',
            department: 'Marketing', tripType: 'domestic', purpose: 'Regional sales kickoff — Q4 planning and brand alignment',
            destination: { city: 'Chicago', country: 'US', region: 'North America' },
            departureDate: '2026-09-08', returnDate: '2026-09-10',
            estimatedCost: { flights: 380, hotel: 600, ground: 120, meals: 200, total: 1300 },
            status: 'completed', priority: 'standard', approvedBy: 'CMO', approvedAt: '2026-08-02T09:30:00Z',
            bookingRef: 'AA-3345-JH', complianceFlags: [], createdAt: '2026-07-25T11:00:00Z',
        },
        {
            id: 'TR-005', requestId: 'TRV-2026-005', employeeId: 'EMP-105', employeeName: 'Yuki Tanaka',
            department: 'Engineering', tripType: 'international', purpose: 'Tokyo office onboarding — Infrastructure team knowledge transfer',
            destination: { city: 'Tokyo', country: 'JP', region: 'APAC' },
            departureDate: '2026-10-20', returnDate: '2026-10-31',
            estimatedCost: { flights: 1800, hotel: 2800, ground: 400, meals: 700, total: 5700 },
            status: 'approved', priority: 'urgent', approvedBy: 'VP Engineering', approvedAt: '2026-08-14T16:00:00Z',
            bookingRef: null, complianceFlags: [], createdAt: '2026-08-10T08:00:00Z',
        },
    ];
}
// Factory: generates realistic expense reports
function createMockExpenseReports() {
    return [
        {
            id: 'ER-001', reportNumber: 'EXP-2026-001', employeeId: 'EMP-104', employeeName: 'James Hartley',
            department: 'Marketing', travelRequestId: 'TR-004', title: 'Q4 Sales Kickoff — Chicago',
            period: { start: '2026-09-08', end: '2026-09-10' }, status: 'reimbursed',
            lineItems: [
                { id: 'LI-001', date: '2026-09-08', category: 'airfare', description: 'Round-trip ORD-DCA', amount: 345, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-002', date: '2026-09-08', category: 'hotel', description: 'Hilton Chicago — 2 nights', amount: 580, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-003', date: '2026-09-08', category: 'ground_transport', description: 'Uber to/from airport', amount: 85, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-004', date: '2026-09-09', category: 'meals', description: 'Team dinner — client event', amount: 145, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
            ],
            subtotal: 1155, taxReclaimable: 92, totalAmount: 1155, currency: 'USD', paymentMethod: 'corporate_card',
            submittedAt: '2026-09-12T10:00:00Z', reviewedBy: 'Finance Ops', reimbursedAt: '2026-09-18T14:00:00Z', complianceScore: 100,
        },
        {
            id: 'ER-002', reportNumber: 'EXP-2026-002', employeeId: 'EMP-102', employeeName: 'Marcus Weber',
            department: 'Product', travelRequestId: 'TR-002', title: 'Meridian Client Demo — London',
            period: { start: '2026-09-15', end: '2026-09-19' }, status: 'under_review',
            lineItems: [
                { id: 'LI-005', date: '2026-09-15', category: 'airfare', description: 'LHR-JFK Business Class', amount: 2180, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-006', date: '2026-09-15', category: 'hotel', description: 'The Savoy — 4 nights', amount: 2600, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: false, notes: 'Exceeds London per diem by 15%' },
                { id: 'LI-007', date: '2026-09-16', category: 'client_entertainment', description: 'Client dinner — The Shard', amount: 420, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-008', date: '2026-09-17', category: 'ground_transport', description: 'Black car service — 3 days', amount: 380, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
            ],
            subtotal: 5580, taxReclaimable: 0, totalAmount: 5580, currency: 'USD', paymentMethod: 'personal_card',
            submittedAt: '2026-09-20T09:00:00Z', reviewedBy: 'Finance Ops', reimbursedAt: null, complianceScore: 85,
        },
        {
            id: 'ER-003', reportNumber: 'EXP-2026-003', employeeId: 'EMP-101', employeeName: 'Sarah Chen',
            department: 'Engineering', travelRequestId: null, title: 'Local Team Offsite — SF',
            period: { start: '2026-08-15', end: '2026-08-15' }, status: 'submitted',
            lineItems: [
                { id: 'LI-009', date: '2026-08-15', category: 'meals', description: 'Team lunch — 12 attendees', amount: 285, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
                { id: 'LI-010', date: '2026-08-15', category: 'office_supplies', description: 'Whiteboard and supplies', amount: 65, currency: 'USD', receiptAttached: true, mileage: null, isCompliant: true, notes: '' },
            ],
            subtotal: 350, taxReclaimable: 28, totalAmount: 350, currency: 'USD', paymentMethod: 'corporate_card',
            submittedAt: '2026-08-16T11:00:00Z', reviewedBy: null, reimbursedAt: null, complianceScore: 100,
        },
    ];
}
// Factory: generates per diem rates by location
function createMockPerDiemRates() {
    return [
        { id: 'PD-001', location: 'New York', country: 'US', region: 'North America', currency: 'USD', rates: { lodging: 280, meals: 79, incidentals: 10, total: 369 }, effectiveDate: '2026-01-01', source: 'GSA', isHighCost: true, notes: 'NYC high-cost area designation' },
        { id: 'PD-002', location: 'San Francisco', country: 'US', region: 'North America', currency: 'USD', rates: { lodging: 310, meals: 85, incidentals: 12, total: 407 }, effectiveDate: '2026-01-01', source: 'GSA', isHighCost: true, notes: 'SF highest COL in US' },
        { id: 'PD-003', location: 'Chicago', country: 'US', region: 'North America', currency: 'USD', rates: { lodging: 200, meals: 69, incidentals: 8, total: 277 }, effectiveDate: '2026-01-01', source: 'GSA', isHighCost: false, notes: '' },
        { id: 'PD-004', location: 'London', country: 'GB', region: 'EMEA', currency: 'GBP', rates: { lodging: 220, meals: 65, incidentals: 12, total: 297 }, effectiveDate: '2026-01-01', source: 'FCO', isHighCost: true, notes: 'Post-Brexit rate adjustment' },
        { id: 'PD-005', location: 'Tokyo', country: 'JP', region: 'APAC', currency: 'JPY', rates: { lodging: 25000, meals: 5500, incidentals: 1500, total: 32000 }, effectiveDate: '2026-01-01', source: 'State Dept', isHighCost: true, notes: 'High exchange rate period' },
        { id: 'PD-006', location: 'Berlin', country: 'DE', region: 'EMEA', currency: 'EUR', rates: { lodging: 160, meals: 55, incidentals: 10, total: 225 }, effectiveDate: '2026-01-01', source: 'FCO', isHighCost: false, notes: 'Competitive European hub' },
    ];
}
// Aggregation: department travel spend
function computeDepartmentSpend(requests) {
    const map = new Map();
    for (const r of requests) {
        const existing = map.get(r.department) || { trips: 0, totalSpend: 0 };
        map.set(r.department, { trips: existing.trips + 1, totalSpend: existing.totalSpend + r.estimatedCost.total });
    }
    return Array.from(map.entries()).map(([department, data]) => ({ department, ...data }));
}
// Aggregation: top destinations
function computeTopDestinations(requests) {
    const map = new Map();
    for (const r of requests) {
        const key = r.destination.city;
        const existing = map.get(key) || { city: r.destination.city, country: r.destination.country, trips: 0, totalSpend: 0 };
        map.set(key, { ...existing, trips: existing.trips + 1, totalSpend: existing.totalSpend + r.estimatedCost.total });
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}
//# sourceMappingURL=EnterpriseTravelModel.js.map