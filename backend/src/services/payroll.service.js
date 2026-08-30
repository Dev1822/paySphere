"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollService = void 0;
class PayrollService {
    /**
     * Helper: parse tag labels back into structured numbers
     */
    static parseTagValue(label) {
        const num = label.replace(/[^0-9.]/g, "");
        return num ? parseFloat(num) : 0;
    }
    /**
     * Calculates salary adjustments for a given employee based on activities
     */
    static calculatePayroll(employee, user, activity) {
        let leaveDays = 0, overtimeHours = 0, bonus = 0, deductions = 0;
        for (const tag of activity.tags) {
            const lower = tag.label.toLowerCase();
            const value = this.parseTagValue(tag.label);
            if (lower.includes("leave") || lower.includes("day")) {
                leaveDays += value;
            }
            else if (lower.includes("overtime") || lower.includes("hr")) {
                overtimeHours += value;
            }
            else if (lower.includes("bonus")) {
                bonus += value;
            }
            else if (lower.includes("deduction")) {
                deductions += value;
            }
        }
        const baseSalary = employee.monthlySalary;
        // Use user default daily rate if available, otherwise fallback to salary/30
        const dailyRate = (user && user.defaultDailyRate) || (baseSalary / 30);
        const leaveDeduction = Math.round(dailyRate * leaveDays);
        // Use employee's overtime rate if set, otherwise use user default, otherwise 0
        const overtimeRate = employee.overtimeRate || (user && user.defaultOvertimeRate) || 0;
        const overtimePay = Math.round(overtimeRate * overtimeHours);
        const netSalary = baseSalary - leaveDeduction + overtimePay + bonus - deductions;
        return {
            baseSalary,
            leaveDays,
            overtimeHours,
            bonus,
            deductions,
            leaveDeduction,
            overtimePay,
            netSalary,
            overtimeRate
        };
    }
}
exports.PayrollService = PayrollService;
//# sourceMappingURL=payroll.service.js.map