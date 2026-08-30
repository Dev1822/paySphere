/**
 * Represents a single time entry (clock-in / clock-out pair) for an employee.
 * Each entry belongs to a specific shift and department, and carries
 * geolocation + biometric verification metadata for compliance audits.
 */
export interface TimeEntryModel {
    entryId: string;
    employeeId: string;
    employeeName: string;
    departmentCode: string;
    departmentName: string;
    shiftId: string;
    clockInISO: string;
    clockOutISO: string | null;
    totalHoursWorked: number;
    overtimeHours: number;
    breakMinutes: number;
    status: 'ACTIVE' | 'COMPLETED' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
    clockInLocation: GeolocationSnapshot;
    clockOutLocation: GeolocationSnapshot | null;
    biometricVerified: boolean;
    approvedBy: string | null;
    flaggedReason: string | null;
}
/**
 * GPS + timestamp snapshot captured at clock-in/out for geo-fencing compliance.
 */
export interface GeolocationSnapshot {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAtISO: string;
    facilityName: string;
}
/**
 * Aggregated attendance record for an employee over a given pay period.
 * Used by the dashboard to render summary cards and compliance alerts.
 */
export interface AttendanceRecordModel {
    recordId: string;
    employeeId: string;
    employeeName: string;
    departmentCode: string;
    departmentName: string;
    payPeriodStartISO: string;
    payPeriodEndISO: string;
    totalScheduledDays: number;
    totalDaysPresent: number;
    totalDaysAbsent: number;
    totalDaysOnLeave: number;
    totalDaysLate: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    attendancePercentage: number;
    complianceStatus: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
    lastUpdatedISO: string;
}
/**
 * A shift definition — reusable template that multiple employees can be
 * assigned to. Carries the expected clock-in/out windows and break policy.
 */
export interface ShiftScheduleModel {
    shiftId: string;
    shiftName: string;
    departmentCode: string;
    dayOfWeek: number;
    expectedClockInISO: string;
    expectedClockOutISO: string;
    gracePeriodMinutes: number;
    breakPolicyMinutes: number;
    maxOvertimeHours: number;
    assignedEmployeeCount: number;
    facilityLocation: GeolocationSnapshot;
    isActive: boolean;
}
/**
 * Overtime rule — defines the legal / policy thresholds for a department.
 * The payroll module reads these to compute premium pay multipliers.
 */
export interface OvertimeRuleModel {
    ruleId: string;
    departmentCode: string;
    departmentName: string;
    dailyRegularHoursCap: number;
    dailyOvertimeCapHours: number;
    weeklyRegularHoursCap: number;
    weeklyOvertimeCapHours: number;
    overtimeMultiplier: number;
    doubleTimeThresholdHours: number;
    doubleTimeMultiplier: number;
    weekendMultiplier: number;
    holidayMultiplier: number;
    effectiveFromISO: string;
    effectiveToISO: string | null;
    approvedBy: string;
    lastModifiedISO: string;
}
/**
 * Summary metric used by the dashboard's KPI stat cards.
 */
export interface AttendanceDashboardMetric {
    label: string;
    value: string;
    delta: number;
    deltaLabel: string;
    icon: string;
    accentColor: string;
}
export declare class TimeEntry implements TimeEntryModel {
    entryId: string;
    employeeId: string;
    employeeName: string;
    departmentCode: string;
    departmentName: string;
    shiftId: string;
    clockInISO: string;
    clockOutISO: string | null;
    totalHoursWorked: number;
    overtimeHours: number;
    breakMinutes: number;
    status: TimeEntryModel['status'];
    clockInLocation: GeolocationSnapshot;
    clockOutLocation: GeolocationSnapshot | null;
    biometricVerified: boolean;
    approvedBy: string | null;
    flaggedReason: string | null;
    constructor(data: Partial<TimeEntryModel>);
    clockOut(): void;
    approve(approverId: string): void;
    flag(reason: string): void;
    toJSON(): TimeEntryModel;
}
export declare class AttendanceRecord implements AttendanceRecordModel {
    recordId: string;
    employeeId: string;
    employeeName: string;
    departmentCode: string;
    departmentName: string;
    payPeriodStartISO: string;
    payPeriodEndISO: string;
    totalScheduledDays: number;
    totalDaysPresent: number;
    totalDaysAbsent: number;
    totalDaysOnLeave: number;
    totalDaysLate: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    attendancePercentage: number;
    complianceStatus: AttendanceRecordModel['complianceStatus'];
    lastUpdatedISO: string;
    constructor(data: Partial<AttendanceRecordModel>);
    recalculateCompliance(): void;
    toJSON(): AttendanceRecordModel;
}
export declare class ShiftSchedule implements ShiftScheduleModel {
    shiftId: string;
    shiftName: string;
    departmentCode: string;
    dayOfWeek: number;
    expectedClockInISO: string;
    expectedClockOutISO: string;
    gracePeriodMinutes: number;
    breakPolicyMinutes: number;
    maxOvertimeHours: number;
    assignedEmployeeCount: number;
    facilityLocation: GeolocationSnapshot;
    isActive: boolean;
    constructor(data: Partial<ShiftScheduleModel>);
    toJSON(): ShiftScheduleModel;
}
export declare class OvertimeRule implements OvertimeRuleModel {
    ruleId: string;
    departmentCode: string;
    departmentName: string;
    dailyRegularHoursCap: number;
    dailyOvertimeCapHours: number;
    weeklyRegularHoursCap: number;
    weeklyOvertimeCapHours: number;
    overtimeMultiplier: number;
    doubleTimeThresholdHours: number;
    doubleTimeMultiplier: number;
    weekendMultiplier: number;
    holidayMultiplier: number;
    effectiveFromISO: string;
    effectiveToISO: string | null;
    approvedBy: string;
    lastModifiedISO: string;
    constructor(data: Partial<OvertimeRuleModel>);
    calculateOvertimePay(regularHourlyRate: number, hoursWorked: number): number;
    toJSON(): OvertimeRuleModel;
}
//# sourceMappingURL=EnterpriseTimeAttendanceModel.d.ts.map