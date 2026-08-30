"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseTimeAttendanceService = void 0;
const express_1 = require("express");
const EnterpriseTimeAttendanceModel_1 = require("../models/EnterpriseTimeAttendanceModel");
// ============================================================================
// Enterprise Time & Attendance Service
// ============================================================================
/**
 * In-memory mock data store for the enterprise time & attendance suite.
 * In production this would be backed by PostgreSQL / MongoDB with full
 * transactional support and audit logging.
 */
const MOCK_TIME_ENTRIES = [
    {
        entryId: 'te-001',
        employeeId: 'emp-1001',
        employeeName: 'Sarah Chen',
        departmentCode: 'ENG',
        departmentName: 'Engineering',
        shiftId: 'shift-eng-morning',
        clockInISO: '2026-08-19T09:02:00Z',
        clockOutISO: '2026-08-19T18:15:00Z',
        totalHoursWorked: 8.72,
        overtimeHours: 0.72,
        breakMinutes: 45,
        status: 'APPROVED',
        clockInLocation: { latitude: 40.7128, longitude: -74.006, accuracyMeters: 3, capturedAtISO: '2026-08-19T09:02:00Z', facilityName: 'HQ New York' },
        clockOutLocation: { latitude: 40.7128, longitude: -74.006, accuracyMeters: 5, capturedAtISO: '2026-08-19T18:15:00Z', facilityName: 'HQ New York' },
        biometricVerified: true,
        approvedBy: 'mgr-201',
        flaggedReason: null,
    },
    {
        entryId: 'te-002',
        employeeId: 'emp-1002',
        employeeName: 'James Rodriguez',
        departmentCode: 'SALES',
        departmentName: 'Global Sales',
        shiftId: 'shift-sales-morning',
        clockInISO: '2026-08-19T08:45:00Z',
        clockOutISO: '2026-08-19T20:30:00Z',
        totalHoursWorked: 11.42,
        overtimeHours: 3.42,
        breakMinutes: 60,
        status: 'FLAGGED',
        clockInLocation: { latitude: 34.0522, longitude: -118.2437, accuracyMeters: 4, capturedAtISO: '2026-08-19T08:45:00Z', facilityName: 'LA Office' },
        clockOutLocation: { latitude: 34.0522, longitude: -118.2437, accuracyMeters: 6, capturedAtISO: '2026-08-19T20:30:00Z', facilityName: 'LA Office' },
        biometricVerified: true,
        approvedBy: null,
        flaggedReason: 'Exceeds daily overtime cap — requires manager review',
    },
    {
        entryId: 'te-003',
        employeeId: 'emp-1003',
        employeeName: 'Priya Patel',
        departmentCode: 'OPS',
        departmentName: 'Corporate Operations',
        shiftId: 'shift-ops-morning',
        clockInISO: '2026-08-19T09:10:00Z',
        clockOutISO: '2026-08-19T17:45:00Z',
        totalHoursWorked: 8.08,
        overtimeHours: 0,
        breakMinutes: 45,
        status: 'COMPLETED',
        clockInLocation: { latitude: 51.5074, longitude: -0.1278, accuracyMeters: 7, capturedAtISO: '2026-08-19T09:10:00Z', facilityName: 'London Office' },
        clockOutLocation: { latitude: 51.5074, longitude: -0.1278, accuracyMeters: 8, capturedAtISO: '2026-08-19T17:45:00Z', facilityName: 'London Office' },
        biometricVerified: true,
        approvedBy: null,
        flaggedReason: null,
    },
    {
        entryId: 'te-004',
        employeeId: 'emp-1004',
        employeeName: 'Marcus Thompson',
        departmentCode: 'ENG',
        departmentName: 'Engineering',
        shiftId: 'shift-eng-morning',
        clockInISO: '2026-08-19T07:30:00Z',
        clockOutISO: '2026-08-19T21:00:00Z',
        totalHoursWorked: 13.0,
        overtimeHours: 5.0,
        breakMinutes: 60,
        status: 'FLAGGED',
        clockInLocation: { latitude: 40.7128, longitude: -74.006, accuracyMeters: 2, capturedAtISO: '2026-08-19T07:30:00Z', facilityName: 'HQ New York' },
        clockOutLocation: { latitude: 40.7128, longitude: -74.006, accuracyMeters: 4, capturedAtISO: '2026-08-19T21:00:00Z', facilityName: 'HQ New York' },
        biometricVerified: false,
        approvedBy: null,
        flaggedReason: 'Biometric verification failed — manual clock-in required',
    },
    {
        entryId: 'te-005',
        employeeId: 'emp-1005',
        employeeName: 'Aiko Tanaka',
        departmentCode: 'FIN',
        departmentName: 'Finance & Accounting',
        shiftId: 'shift-fin-morning',
        clockInISO: '2026-08-19T09:00:00Z',
        clockOutISO: null,
        totalHoursWorked: 0,
        overtimeHours: 0,
        breakMinutes: 0,
        status: 'ACTIVE',
        clockInLocation: { latitude: 35.6762, longitude: 139.6503, accuracyMeters: 6, capturedAtISO: '2026-08-19T09:00:00Z', facilityName: 'Tokyo Office' },
        clockOutLocation: null,
        biometricVerified: true,
        approvedBy: null,
        flaggedReason: null,
    },
    {
        entryId: 'te-006',
        employeeId: 'emp-1006',
        employeeName: 'Elena Vasquez',
        departmentCode: 'SALES',
        departmentName: 'Global Sales',
        shiftId: 'shift-sales-morning',
        clockInISO: '2026-08-19T08:58:00Z',
        clockOutISO: '2026-08-19T18:05:00Z',
        totalHoursWorked: 8.45,
        overtimeHours: 0.45,
        breakMinutes: 45,
        status: 'APPROVED',
        clockInLocation: { latitude: 52.52, longitude: 13.405, accuracyMeters: 4, capturedAtISO: '2026-08-19T08:58:00Z', facilityName: 'Berlin Office' },
        clockOutLocation: { latitude: 52.52, longitude: 13.405, accuracyMeters: 5, capturedAtISO: '2026-08-19T18:05:00Z', facilityName: 'Berlin Office' },
        biometricVerified: true,
        approvedBy: 'mgr-301',
        flaggedReason: null,
    },
    {
        entryId: 'te-007',
        employeeId: 'emp-1007',
        employeeName: 'David Kim',
        departmentCode: 'HR',
        departmentName: 'People & Culture',
        shiftId: 'shift-hr-morning',
        clockInISO: '2026-08-19T09:30:00Z',
        clockOutISO: '2026-08-19T17:00:00Z',
        totalHoursWorked: 7.0,
        overtimeHours: 0,
        breakMinutes: 30,
        status: 'COMPLETED',
        clockInLocation: { latitude: 37.7749, longitude: -122.4194, accuracyMeters: 8, capturedAtISO: '2026-08-19T09:30:00Z', facilityName: 'SF Office' },
        clockOutLocation: { latitude: 37.7749, longitude: -122.4194, accuracyMeters: 9, capturedAtISO: '2026-08-19T17:00:00Z', facilityName: 'SF Office' },
        biometricVerified: true,
        approvedBy: null,
        flaggedReason: null,
    },
    {
        entryId: 'te-008',
        employeeId: 'emp-1008',
        employeeName: 'Fatima Al-Rashid',
        departmentCode: 'ENG',
        departmentName: 'Engineering',
        shiftId: 'shift-eng-morning',
        clockInISO: '2026-08-19T09:05:00Z',
        clockOutISO: '2026-08-19T19:20:00Z',
        totalHoursWorked: 9.58,
        overtimeHours: 1.58,
        breakMinutes: 45,
        status: 'APPROVED',
        clockInLocation: { latitude: 25.2048, longitude: 55.2708, accuracyMeters: 4, capturedAtISO: '2026-08-19T09:05:00Z', facilityName: 'Dubai Office' },
        clockOutLocation: { latitude: 25.2048, longitude: 55.2708, accuracyMeters: 5, capturedAtISO: '2026-08-19T19:20:00Z', facilityName: 'Dubai Office' },
        biometricVerified: true,
        approvedBy: 'mgr-201',
        flaggedReason: null,
    },
];
const MOCK_ATTENDANCE_RECORDS = [
    {
        recordId: 'ar-001', employeeId: 'emp-1001', employeeName: 'Sarah Chen', departmentCode: 'ENG', departmentName: 'Engineering',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 11, totalDaysAbsent: 0, totalDaysOnLeave: 0, totalDaysLate: 1,
        totalRegularHours: 88, totalOvertimeHours: 7.5, attendancePercentage: 100, complianceStatus: 'COMPLIANT', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
    {
        recordId: 'ar-002', employeeId: 'emp-1002', employeeName: 'James Rodriguez', departmentCode: 'SALES', departmentName: 'Global Sales',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 9, totalDaysAbsent: 1, totalDaysOnLeave: 1, totalDaysLate: 3,
        totalRegularHours: 72, totalOvertimeHours: 18.2, attendancePercentage: 81.82, complianceStatus: 'WARNING', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
    {
        recordId: 'ar-003', employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', departmentName: 'Corporate Operations',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 11, totalDaysAbsent: 0, totalDaysOnLeave: 0, totalDaysLate: 0,
        totalRegularHours: 88, totalOvertimeHours: 2.1, attendancePercentage: 100, complianceStatus: 'COMPLIANT', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
    {
        recordId: 'ar-004', employeeId: 'emp-1004', employeeName: 'Marcus Thompson', departmentCode: 'ENG', departmentName: 'Engineering',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 8, totalDaysAbsent: 2, totalDaysOnLeave: 1, totalDaysLate: 4,
        totalRegularHours: 64, totalOvertimeHours: 22.5, attendancePercentage: 72.73, complianceStatus: 'NON_COMPLIANT', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
    {
        recordId: 'ar-005', employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', departmentName: 'Finance & Accounting',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 11, totalDaysAbsent: 0, totalDaysOnLeave: 0, totalDaysLate: 0,
        totalRegularHours: 88, totalOvertimeHours: 5.3, attendancePercentage: 100, complianceStatus: 'COMPLIANT', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
    {
        recordId: 'ar-006', employeeId: 'emp-1006', employeeName: 'Elena Vasquez', departmentCode: 'SALES', departmentName: 'Global Sales',
        payPeriodStartISO: '2026-08-01', payPeriodEndISO: '2026-08-15',
        totalScheduledDays: 11, totalDaysPresent: 10, totalDaysAbsent: 0, totalDaysOnLeave: 1, totalDaysLate: 1,
        totalRegularHours: 80, totalOvertimeHours: 6.8, attendancePercentage: 90.91, complianceStatus: 'COMPLIANT', lastUpdatedISO: '2026-08-15T23:59:00Z',
    },
];
const MOCK_SHIFTS = [
    { shiftId: 'shift-eng-morning', shiftName: 'Engineering Morning', departmentCode: 'ENG', dayOfWeek: 1, expectedClockInISO: '09:00', expectedClockOutISO: '17:00', gracePeriodMinutes: 15, breakPolicyMinutes: 60, maxOvertimeHours: 4, assignedEmployeeCount: 85, facilityLocation: { latitude: 40.7128, longitude: -74.006, accuracyMeters: 10, capturedAtISO: '2026-01-01T00:00:00Z', facilityName: 'HQ New York' }, isActive: true },
    { shiftId: 'shift-sales-morning', shiftName: 'Sales Morning', departmentCode: 'SALES', dayOfWeek: 1, expectedClockInISO: '08:30', expectedClockOutISO: '17:30', gracePeriodMinutes: 10, breakPolicyMinutes: 60, maxOvertimeHours: 3, assignedEmployeeCount: 62, facilityLocation: { latitude: 34.0522, longitude: -118.2437, accuracyMeters: 10, capturedAtISO: '2026-01-01T00:00:00Z', facilityName: 'LA Office' }, isActive: true },
    { shiftId: 'shift-ops-morning', shiftName: 'Operations Morning', departmentCode: 'OPS', dayOfWeek: 1, expectedClockInISO: '09:00', expectedClockOutISO: '17:00', gracePeriodMinutes: 15, breakPolicyMinutes: 45, maxOvertimeHours: 2, assignedEmployeeCount: 34, facilityLocation: { latitude: 51.5074, longitude: -0.1278, accuracyMeters: 10, capturedAtISO: '2026-01-01T00:00:00Z', facilityName: 'London Office' }, isActive: true },
    { shiftId: 'shift-fin-morning', shiftName: 'Finance Morning', departmentCode: 'FIN', dayOfWeek: 1, expectedClockInISO: '09:00', expectedClockOutISO: '17:00', gracePeriodMinutes: 10, breakPolicyMinutes: 45, maxOvertimeHours: 3, assignedEmployeeCount: 28, facilityLocation: { latitude: 35.6762, longitude: 139.6503, accuracyMeters: 10, capturedAtISO: '2026-01-01T00:00:00Z', facilityName: 'Tokyo Office' }, isActive: true },
    { shiftId: 'shift-hr-morning', shiftName: 'HR Morning', departmentCode: 'HR', dayOfWeek: 1, expectedClockInISO: '09:00', expectedClockOutISO: '17:00', gracePeriodMinutes: 15, breakPolicyMinutes: 30, maxOvertimeHours: 2, assignedEmployeeCount: 18, facilityLocation: { latitude: 37.7749, longitude: -122.4194, accuracyMeters: 10, capturedAtISO: '2026-01-01T00:00:00Z', facilityName: 'SF Office' }, isActive: true },
];
const MOCK_OVERTIME_RULES = [
    { ruleId: 'otr-001', departmentCode: 'ENG', departmentName: 'Engineering', dailyRegularHoursCap: 8, dailyOvertimeCapHours: 4, weeklyRegularHoursCap: 40, weeklyOvertimeCapHours: 20, overtimeMultiplier: 1.5, doubleTimeThresholdHours: 12, doubleTimeMultiplier: 2.0, weekendMultiplier: 2.0, holidayMultiplier: 2.5, effectiveFromISO: '2026-01-01', effectiveToISO: null, approvedBy: 'cfo-001', lastModifiedISO: '2026-06-15T10:00:00Z' },
    { ruleId: 'otr-002', departmentCode: 'SALES', departmentName: 'Global Sales', dailyRegularHoursCap: 8, dailyOvertimeCapHours: 3, weeklyRegularHoursCap: 40, weeklyOvertimeCapHours: 15, overtimeMultiplier: 1.5, doubleTimeThresholdHours: 11, doubleTimeMultiplier: 2.0, weekendMultiplier: 2.0, holidayMultiplier: 2.5, effectiveFromISO: '2026-01-01', effectiveToISO: null, approvedBy: 'cfo-001', lastModifiedISO: '2026-06-15T10:00:00Z' },
    { ruleId: 'otr-003', departmentCode: 'OPS', departmentName: 'Corporate Operations', dailyRegularHoursCap: 8, dailyOvertimeCapHours: 2, weeklyRegularHoursCap: 40, weeklyOvertimeCapHours: 10, overtimeMultiplier: 1.5, doubleTimeThresholdHours: 10, doubleTimeMultiplier: 2.0, weekendMultiplier: 2.0, holidayMultiplier: 2.5, effectiveFromISO: '2026-01-01', effectiveToISO: null, approvedBy: 'cfo-001', lastModifiedISO: '2026-06-15T10:00:00Z' },
];
// ============================================================================
// Service Class
// ============================================================================
class EnterpriseTimeAttendanceService {
    timeEntries;
    attendanceRecords;
    shifts;
    overtimeRules;
    constructor() {
        this.timeEntries = [...MOCK_TIME_ENTRIES];
        this.attendanceRecords = [...MOCK_ATTENDANCE_RECORDS];
        this.shifts = [...MOCK_SHIFTS];
        this.overtimeRules = [...MOCK_OVERTIME_RULES];
    }
    // ── Time Entries ──────────────────────────────────────────────────────────
    getTimeEntries(filters) {
        let results = [...this.timeEntries];
        if (filters?.departmentCode) {
            results = results.filter(e => e.departmentCode === filters.departmentCode);
        }
        if (filters?.status) {
            results = results.filter(e => e.status === filters.status);
        }
        if (filters?.employeeId) {
            results = results.filter(e => e.employeeId === filters.employeeId);
        }
        return results;
    }
    getTimeEntryById(id) {
        return this.timeEntries.find(e => e.entryId === id);
    }
    approveTimeEntry(id, approverId) {
        const entry = this.timeEntries.find(e => e.entryId === id);
        if (!entry)
            return null;
        entry.status = 'APPROVED';
        entry.approvedBy = approverId;
        return entry;
    }
    rejectTimeEntry(id, reason) {
        const entry = this.timeEntries.find(e => e.entryId === id);
        if (!entry)
            return null;
        entry.status = 'REJECTED';
        entry.flaggedReason = reason;
        return entry;
    }
    // ── Attendance Records ────────────────────────────────────────────────────
    getAttendanceRecords(filters) {
        let results = [...this.attendanceRecords];
        if (filters?.departmentCode) {
            results = results.filter(r => r.departmentCode === filters.departmentCode);
        }
        if (filters?.complianceStatus) {
            results = results.filter(r => r.complianceStatus === filters.complianceStatus);
        }
        return results;
    }
    // ── Dashboard Aggregates ──────────────────────────────────────────────────
    getDashboardMetrics() {
        const totalEmployees = this.attendanceRecords.length;
        const presentToday = this.timeEntries.filter(e => e.status === 'ACTIVE' || e.status === 'COMPLETED' || e.status === 'APPROVED').length;
        const totalRegularHours = this.attendanceRecords.reduce((sum, r) => sum + r.totalRegularHours, 0);
        const totalOvertimeHours = this.attendanceRecords.reduce((sum, r) => sum + r.totalOvertimeHours, 0);
        const compliantCount = this.attendanceRecords.filter(r => r.complianceStatus === 'COMPLIANT').length;
        const flaggedEntries = this.timeEntries.filter(e => e.status === 'FLAGGED').length;
        const avgAttendance = totalEmployees > 0 ? Math.round(this.attendanceRecords.reduce((s, r) => s + r.attendancePercentage, 0) / totalEmployees * 100) / 100 : 0;
        return {
            totalEmployees,
            presentToday,
            absentToday: totalEmployees - presentToday,
            totalRegularHours,
            totalOvertimeHours,
            overtimeCostEstimateUSD: Math.round(totalOvertimeHours * 45 * 1.5),
            compliantPercentage: totalEmployees > 0 ? Math.round((compliantCount / totalEmployees) * 10000) / 100 : 0,
            flaggedEntries,
            avgAttendance,
        };
    }
    // ── Shifts ────────────────────────────────────────────────────────────────
    getShifts() {
        return [...this.shifts];
    }
    // ── Overtime Rules ────────────────────────────────────────────────────────
    getOvertimeRules() {
        return [...this.overtimeRules];
    }
}
exports.EnterpriseTimeAttendanceService = EnterpriseTimeAttendanceService;
// ============================================================================
// Express Router
// ============================================================================
const service = new EnterpriseTimeAttendanceService();
const router = (0, express_1.Router)();
router.get('/time-attendance/entries', (req, res) => {
    const { departmentCode, status, employeeId } = req.query;
    const entries = service.getTimeEntries({
        departmentCode: departmentCode,
        status: status,
        employeeId: employeeId,
    });
    res.json({ success: true, data: entries });
});
router.get('/time-attendance/entries/:id', (req, res) => {
    const entry = service.getTimeEntryById(req.params.id);
    if (!entry)
        return res.status(404).json({ success: false, error: 'Time entry not found' });
    res.json({ success: true, data: entry });
});
router.post('/time-attendance/entries/:id/approve', (req, res) => {
    const updated = service.approveTimeEntry(req.params.id, req.body.approverId || 'system');
    if (!updated)
        return res.status(404).json({ success: false, error: 'Time entry not found' });
    res.json({ success: true, data: updated });
});
router.post('/time-attendance/entries/:id/reject', (req, res) => {
    const updated = service.rejectTimeEntry(req.params.id, req.body.reason || 'Rejected by manager');
    if (!updated)
        return res.status(404).json({ success: false, error: 'Time entry not found' });
    res.json({ success: true, data: updated });
});
router.get('/time-attendance/records', (req, res) => {
    const { departmentCode, complianceStatus } = req.query;
    const records = service.getAttendanceRecords({
        departmentCode: departmentCode,
        complianceStatus: complianceStatus,
    });
    res.json({ success: true, data: records });
});
router.get('/time-attendance/dashboard-metrics', (req, res) => {
    const metrics = service.getDashboardMetrics();
    res.json({ success: true, data: metrics });
});
router.get('/time-attendance/shifts', (req, res) => {
    const shifts = service.getShifts();
    res.json({ success: true, data: shifts });
});
router.get('/time-attendance/overtime-rules', (req, res) => {
    const rules = service.getOvertimeRules();
    res.json({ success: true, data: rules });
});
exports.default = router;
//# sourceMappingURL=EnterpriseTimeAttendanceService.js.map