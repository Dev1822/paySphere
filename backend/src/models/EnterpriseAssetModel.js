"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockAssets = createMockAssets;
exports.createMockSoftwareLicenses = createMockSoftwareLicenses;
exports.createMockAssetRequests = createMockAssetRequests;
exports.computeAssetsByCategory = computeAssetsByCategory;
exports.computeAssetsByOffice = computeAssetsByOffice;
exports.computeDepreciationSummary = computeDepreciationSummary;
function createMockAssets() {
    return [
        { id: 'A-001', tagNumber: 'IT-2024-001', name: 'MacBook Pro 16" M3', category: 'laptop', model: 'MacBook Pro M3 Max', serialNumber: 'C02X1234H02D', purchaseDate: '2024-06-15', purchasePrice: 3499, currentValue: 2799, depreciationRate: 20, status: 'active', condition: 'excellent', assignedTo: 'Sarah Chen', department: 'Engineering', location: 'SF Office', office: 'San Francisco', warrantyExpiry: '2027-06-15', lastMaintenanceDate: '2026-03-01', nextMaintenanceDate: '2026-09-01', notes: '' },
        { id: 'A-002', tagNumber: 'IT-2024-002', name: 'Dell UltraSharp U2723QE', category: 'monitor', model: 'U2723QE 27" 4K', serialNumber: 'DL-88421HKJ', purchaseDate: '2024-06-15', purchasePrice: 619, currentValue: 464, depreciationRate: 25, status: 'active', condition: 'good', assignedTo: 'Sarah Chen', department: 'Engineering', location: 'SF Office', office: 'San Francisco', warrantyExpiry: '2027-06-15', lastMaintenanceDate: null, nextMaintenanceDate: null, notes: '' },
        { id: 'A-003', tagNumber: 'IT-2024-003', name: 'iPhone 15 Pro', category: 'phone', model: 'iPhone 15 Pro 256GB', serialNumber: 'FN2X9876GH3K', purchaseDate: '2024-09-01', purchasePrice: 1199, currentValue: 959, depreciationRate: 20, status: 'active', condition: 'excellent', assignedTo: 'Marcus Weber', department: 'Product', location: 'SF Office', office: 'San Francisco', warrantyExpiry: '2025-09-01', lastMaintenanceDate: null, nextMaintenanceDate: null, notes: 'Company phone with corporate line' },
        { id: 'A-004', tagNumber: 'IT-2023-004', name: 'ThinkPad X1 Carbon', category: 'laptop', model: 'X1 Carbon Gen 11', serialNumber: 'PF-3KJ2891', purchaseDate: '2023-03-10', purchasePrice: 1899, currentValue: 1139, depreciationRate: 30, status: 'on_loan', condition: 'good', assignedTo: 'James Hartley', department: 'Marketing', location: 'NYC Office', office: 'New York', warrantyExpiry: '2026-03-10', lastMaintenanceDate: '2025-11-15', nextMaintenanceDate: '2026-05-15', notes: 'Loan to contractor - due back Q4' },
        { id: 'A-005', tagNumber: 'IT-2025-005', name: 'iPad Pro 12.9"', category: 'tablet', model: 'iPad Pro M2 256GB', serialNumber: 'DLX88721QW', purchaseDate: '2025-01-20', purchasePrice: 1099, currentValue: 934, depreciationRate: 15, status: 'available', condition: 'excellent', assignedTo: null, department: 'IT', location: 'SF Storage', office: 'San Francisco', warrantyExpiry: '2027-01-20', lastMaintenanceDate: null, nextMaintenanceDate: null, notes: 'Available for assignment' },
        { id: 'A-006', tagNumber: 'SRV-2023-001', name: 'Dell PowerEdge R750', category: 'server', model: 'R750 2U Rack Server', serialNumber: 'SRV-DL-99281', purchaseDate: '2023-08-01', purchasePrice: 12500, currentValue: 8750, depreciationRate: 25, status: 'active', condition: 'good', assignedTo: null, department: 'IT', location: 'SF DC-R1', office: 'San Francisco', warrantyExpiry: '2028-08-01', lastMaintenanceDate: '2026-06-01', nextMaintenanceDate: '2026-12-01', notes: 'Primary staging server' },
    ];
}
function createMockSoftwareLicenses() {
    return [
        { id: 'SL-001', softwareName: 'Figma Enterprise', vendor: 'Figma Inc.', licenseKey: 'FIG-ENT-2026-XXXX', totalSeats: 50, usedSeats: 42, expiryDate: '2027-01-01', cost: 7200, autoRenew: true, status: 'active' },
        { id: 'SL-002', softwareName: 'GitHub Enterprise', vendor: 'GitHub Inc.', licenseKey: 'GH-ENT-2026-YYYY', totalSeats: 100, usedSeats: 87, expiryDate: '2027-03-15', cost: 25200, autoRenew: true, status: 'active' },
        { id: 'SL-003', softwareName: 'Slack Business+', vendor: 'Salesforce', licenseKey: 'SLK-BIZ-2026-ZZZZ', totalSeats: 621, usedSeats: 598, expiryDate: '2026-10-01', cost: 18630, autoRenew: true, status: 'expiring' },
        { id: 'SL-004', softwareName: 'Notion Team', vendor: 'Notion Labs', licenseKey: 'NOT-TEAM-2025', totalSeats: 30, usedSeats: 30, expiryDate: '2026-09-15', cost: 3600, autoRenew: false, status: 'expiring' },
        { id: 'SL-005', softwareName: 'Zoom Business', vendor: 'Zoom Video', licenseKey: 'ZM-BIZ-2026', totalSeats: 621, usedSeats: 489, expiryDate: '2026-12-31', cost: 24840, autoRenew: true, status: 'active' },
    ];
}
function createMockAssetRequests() {
    return [
        { id: 'AR-001', requestNumber: 'REQ-2026-001', employeeId: 'EMP-201', employeeName: 'Liam O\'Brien', department: 'Operations', assetType: 'laptop', justification: 'New hire onboarding — need dev machine', priority: 'high', status: 'approved', requestedAt: '2026-08-10T09:00:00Z', fulfilledAt: null },
        { id: 'AR-002', requestNumber: 'REQ-2026-002', employeeId: 'EMP-202', employeeName: 'Yuki Tanaka', department: 'Engineering', assetType: 'monitor', justification: 'Dual monitor setup for productivity', priority: 'medium', status: 'pending', requestedAt: '2026-08-15T14:00:00Z', fulfilledAt: null },
        { id: 'AR-003', requestNumber: 'REQ-2026-003', employeeId: 'EMP-203', employeeName: 'Priya Patel', department: 'Finance', assetType: 'laptop', justification: 'Current laptop has hardware failure', priority: 'urgent', status: 'fulfilled', requestedAt: '2026-08-01T08:00:00Z', fulfilledAt: '2026-08-02T16:00:00Z' },
        { id: 'AR-004', requestNumber: 'REQ-2026-004', employeeId: 'EMP-204', employeeName: 'Erik Lindqvist', department: 'Logistics', assetType: 'phone', justification: 'New field sales role — needs mobile device', priority: 'medium', status: 'pending', requestedAt: '2026-08-18T10:00:00Z', fulfilledAt: null },
    ];
}
// Aggregation: assets by category
function computeAssetsByCategory(assets) {
    const map = new Map();
    for (const a of assets) {
        const existing = map.get(a.category) || { count: 0, totalValue: 0 };
        map.set(a.category, { count: existing.count + 1, totalValue: existing.totalValue + a.currentValue });
    }
    return Array.from(map.entries()).map(([category, data]) => ({ category, ...data }));
}
// Aggregation: assets by office
function computeAssetsByOffice(assets) {
    const map = new Map();
    for (const a of assets) {
        const existing = map.get(a.office) || { count: 0, totalValue: 0 };
        map.set(a.office, { count: existing.count + 1, totalValue: existing.totalValue + a.currentValue });
    }
    return Array.from(map.entries()).map(([office, data]) => ({ office, ...data }));
}
// Aggregation: depreciation summary
function computeDepreciationSummary(assets) {
    const totalPurchasePrice = assets.reduce((s, a) => s + a.purchasePrice, 0);
    const totalCurrentValue = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalDepreciation = totalPurchasePrice - totalCurrentValue;
    const avgDepreciationRate = assets.length > 0 ? Math.round(assets.reduce((s, a) => s + a.depreciationRate, 0) / assets.length) : 0;
    return { totalPurchasePrice, totalCurrentValue, totalDepreciation, avgDepreciationRate };
}
//# sourceMappingURL=EnterpriseAssetModel.js.map