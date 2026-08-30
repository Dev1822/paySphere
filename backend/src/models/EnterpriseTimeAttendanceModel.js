"use strict";
// ============================================================================
// Enterprise Time & Attendance Management Suite — Data Models
// PaySphere Enterprise HR Module
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.OvertimeRule = exports.ShiftSchedule = exports.AttendanceRecord = exports.TimeEntry = void 0;
// ============================================================================
// Model Factory Classes
// ============================================================================
class TimeEntry {
    entryId;
    employeeId;
    employeeName;
    departmentCode;
    departmentName;
    shiftId;
    clockInISO;
    clockOutISO;
    totalHoursWorked;
    overtimeHours;
    breakMinutes;
    status;
    clockInLocation;
    clockOutLocation;
    biometricVerified;
    approvedBy;
    flaggedReason;
    constructor(data) {
        this.entryId = data.entryId || `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.employeeId = data.employeeId || 'emp-001';
        this.employeeName = data.employeeName || 'Unknown Employee';
        this.departmentCode = data.departmentCode || 'ENG';
        this.departmentName = data.departmentName || 'Engineering';
        this.shiftId = data.shiftId || 'shift-01';
        this.clockInISO = data.clockInISO || new Date().toISOString();
        this.clockOutISO = data.clockOutISO || null;
        this.totalHoursWorked = data.totalHoursWorked || 0;
        this.overtimeHours = data.overtimeHours || 0;
        this.breakMinutes = data.breakMinutes || 30;
        this.status = data.status || 'ACTIVE';
        this.clockInLocation = data.clockInLocation || {
            latitude: 40.7128,
            longitude: -74.006,
            accuracyMeters: 5,
            capturedAtISO: this.clockInISO,
            facilityName: 'HQ New York',
        };
        this.clockOutLocation = data.clockOutLocation || null;
        this.biometricVerified = data.biometricVerified ?? true;
        this.approvedBy = data.approvedBy || null;
        this.flaggedReason = data.flaggedReason || null;
    }
    clockOut() {
        this.clockOutISO = new Date().toISOString();
        const clockIn = new Date(this.clockInISO).getTime();
        const clockOut = new Date(this.clockOutISO).getTime();
        const totalMinutes = (clockOut - clockIn) / 60000;
        const workedMinutes = totalMinutes - this.breakMinutes;
        this.totalHoursWorked = Math.round((workedMinutes / 60) * 100) / 100;
        this.overtimeHours = Math.max(0, this.totalHoursWorked - 8);
        this.status = 'COMPLETED';
    }
    approve(approverId) {
        this.status = 'APPROVED';
        this.approvedBy = approverId;
    }
    flag(reason) {
        this.status = 'FLAGGED';
        this.flaggedReason = reason;
    }
    toJSON() {
        return {
            entryId: this.entryId,
            employeeId: this.employeeId,
            employeeName: this.employeeName,
            departmentCode: this.departmentCode,
            departmentName: this.departmentName,
            shiftId: this.shiftId,
            clockInISO: this.clockInISO,
            clockOutISO: this.clockOutISO,
            totalHoursWorked: this.totalHoursWorked,
            overtimeHours: this.overtimeHours,
            breakMinutes: this.breakMinutes,
            status: this.status,
            clockInLocation: this.clockInLocation,
            clockOutLocation: this.clockOutLocation,
            biometricVerified: this.biometricVerified,
            approvedBy: this.approvedBy,
            flaggedReason: this.flaggedReason,
        };
    }
}
exports.TimeEntry = TimeEntry;
class AttendanceRecord {
    recordId;
    employeeId;
    employeeName;
    departmentCode;
    departmentName;
    payPeriodStartISO;
    payPeriodEndISO;
    totalScheduledDays;
    totalDaysPresent;
    totalDaysAbsent;
    totalDaysOnLeave;
    totalDaysLate;
    totalRegularHours;
    totalOvertimeHours;
    attendancePercentage;
    complianceStatus;
    lastUpdatedISO;
    constructor(data) {
        this.recordId = data.recordId || `ar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.employeeId = data.employeeId || 'emp-001';
        this.employeeName = data.employeeName || 'Unknown';
        this.departmentCode = data.departmentCode || 'ENG';
        this.departmentName = data.departmentName || 'Engineering';
        this.payPeriodStartISO = data.payPeriodStartISO || new Date().toISOString();
        this.payPeriodEndISO = data.payPeriodEndISO || new Date().toISOString();
        this.totalScheduledDays = data.totalScheduledDays || 22;
        this.totalDaysPresent = data.totalDaysPresent || 0;
        this.totalDaysAbsent = data.totalDaysAbsent || 0;
        this.totalDaysOnLeave = data.totalDaysOnLeave || 0;
        this.totalDaysLate = data.totalDaysLate || 0;
        this.totalRegularHours = data.totalRegularHours || 0;
        this.totalOvertimeHours = data.totalOvertimeHours || 0;
        this.attendancePercentage =
            data.attendancePercentage ??
                (this.totalScheduledDays > 0
                    ? Math.round((this.totalDaysPresent / this.totalScheduledDays) * 10000) / 100
                    : 0);
        this.complianceStatus = data.complianceStatus || 'UNDER_REVIEW';
        this.lastUpdatedISO = data.lastUpdatedISO || new Date().toISOString();
    }
    recalculateCompliance() {
        if (this.attendancePercentage >= 95) {
            this.complianceStatus = 'COMPLIANT';
        }
        else if (this.attendancePercentage >= 85) {
            this.complianceStatus = 'WARNING';
        }
        else {
            this.complianceStatus = 'NON_COMPLIANT';
        }
    }
    toJSON() {
        return {
            recordId: this.recordId,
            employeeId: this.employeeId,
            employeeName: this.employeeName,
            departmentCode: this.departmentCode,
            departmentName: this.departmentName,
            payPeriodStartISO: this.payPeriodStartISO,
            payPeriodEndISO: this.payPeriodEndISO,
            totalScheduledDays: this.totalScheduledDays,
            totalDaysPresent: this.totalDaysPresent,
            totalDaysAbsent: this.totalDaysAbsent,
            totalDaysOnLeave: this.totalDaysOnLeave,
            totalDaysLate: this.totalDaysLate,
            totalRegularHours: this.totalRegularHours,
            totalOvertimeHours: this.totalOvertimeHours,
            attendancePercentage: this.attendancePercentage,
            complianceStatus: this.complianceStatus,
            lastUpdatedISO: this.lastUpdatedISO,
        };
    }
}
exports.AttendanceRecord = AttendanceRecord;
class ShiftSchedule {
    shiftId;
    shiftName;
    departmentCode;
    dayOfWeek;
    expectedClockInISO;
    expectedClockOutISO;
    gracePeriodMinutes;
    breakPolicyMinutes;
    maxOvertimeHours;
    assignedEmployeeCount;
    facilityLocation;
    isActive;
    constructor(data) {
        this.shiftId = data.shiftId || `shift_${Date.now()}`;
        this.shiftName = data.shiftName || 'Morning Shift';
        this.departmentCode = data.departmentCode || 'ENG';
        this.dayOfWeek = data.dayOfWeek ?? 1;
        this.expectedClockInISO = data.expectedClockInISO || '09:00';
        this.expectedClockOutISO = data.expectedClockOutISO || '17:00';
        this.gracePeriodMinutes = data.gracePeriodMinutes || 15;
        this.breakPolicyMinutes = data.breakPolicyMinutes || 60;
        this.maxOvertimeHours = data.maxOvertimeHours || 4;
        this.assignedEmployeeCount = data.assignedEmployeeCount || 0;
        this.facilityLocation = data.facilityLocation || {
            latitude: 40.7128,
            longitude: -74.006,
            accuracyMeters: 10,
            capturedAtISO: new Date().toISOString(),
            facilityName: 'HQ New York',
        };
        this.isActive = data.isActive ?? true;
    }
    toJSON() {
        return {
            shiftId: this.shiftId,
            shiftName: this.shiftName,
            departmentCode: this.departmentCode,
            dayOfWeek: this.dayOfWeek,
            expectedClockInISO: this.expectedClockInISO,
            expectedClockOutISO: this.expectedClockOutISO,
            gracePeriodMinutes: this.gracePeriodMinutes,
            breakPolicyMinutes: this.breakPolicyMinutes,
            maxOvertimeHours: this.maxOvertimeHours,
            assignedEmployeeCount: this.assignedEmployeeCount,
            facilityLocation: this.facilityLocation,
            isActive: this.isActive,
        };
    }
}
exports.ShiftSchedule = ShiftSchedule;
class OvertimeRule {
    ruleId;
    departmentCode;
    departmentName;
    dailyRegularHoursCap;
    dailyOvertimeCapHours;
    weeklyRegularHoursCap;
    weeklyOvertimeCapHours;
    overtimeMultiplier;
    doubleTimeThresholdHours;
    doubleTimeMultiplier;
    weekendMultiplier;
    holidayMultiplier;
    effectiveFromISO;
    effectiveToISO;
    approvedBy;
    lastModifiedISO;
    constructor(data) {
        this.ruleId = data.ruleId || `otr_${Date.now()}`;
        this.departmentCode = data.departmentCode || 'ENG';
        this.departmentName = data.departmentName || 'Engineering';
        this.dailyRegularHoursCap = data.dailyRegularHoursCap || 8;
        this.dailyOvertimeCapHours = data.dailyOvertimeCapHours || 4;
        this.weeklyRegularHoursCap = data.weeklyRegularHoursCap || 40;
        this.weeklyOvertimeCapHours = data.weeklyOvertimeCapHours || 20;
        this.overtimeMultiplier = data.overtimeMultiplier || 1.5;
        this.doubleTimeThresholdHours = data.doubleTimeThresholdHours || 12;
        this.doubleTimeMultiplier = data.doubleTimeMultiplier || 2.0;
        this.weekendMultiplier = data.weekendMultiplier || 2.0;
        this.holidayMultiplier = data.holidayMultiplier || 2.5;
        this.effectiveFromISO = data.effectiveFromISO || new Date().toISOString();
        this.effectiveToISO = data.effectiveToISO || null;
        this.approvedBy = data.approvedBy || 'system';
        this.lastModifiedISO = data.lastModifiedISO || new Date().toISOString();
    }
    calculateOvertimePay(regularHourlyRate, hoursWorked) {
        const regularPay = Math.min(hoursWorked, this.dailyRegularHoursCap) * regularHourlyRate;
        const overtimePay = Math.min(Math.max(0, hoursWorked - this.dailyRegularHoursCap), this.dailyOvertimeCapHours) *
            regularHourlyRate *
            this.overtimeMultiplier;
        const doubleTimePay = Math.max(0, hoursWorked - this.doubleTimeThresholdHours) *
            regularHourlyRate *
            this.doubleTimeMultiplier;
        return Math.round((regularPay + overtimePay + doubleTimePay) * 100) / 100;
    }
    toJSON() {
        return {
            ruleId: this.ruleId,
            departmentCode: this.departmentCode,
            departmentName: this.departmentName,
            dailyRegularHoursCap: this.dailyRegularHoursCap,
            dailyOvertimeCapHours: this.dailyOvertimeCapHours,
            weeklyRegularHoursCap: this.weeklyRegularHoursCap,
            weeklyOvertimeCapHours: this.weeklyOvertimeCapHours,
            overtimeMultiplier: this.overtimeMultiplier,
            doubleTimeThresholdHours: this.doubleTimeThresholdHours,
            doubleTimeMultiplier: this.doubleTimeMultiplier,
            weekendMultiplier: this.weekendMultiplier,
            holidayMultiplier: this.holidayMultiplier,
            effectiveFromISO: this.effectiveFromISO,
            effectiveToISO: this.effectiveToISO,
            approvedBy: this.approvedBy,
            lastModifiedISO: this.lastModifiedISO,
        };
    }
}
exports.OvertimeRule = OvertimeRule;
//# sourceMappingURL=EnterpriseTimeAttendanceModel.js.map