export interface Tag {
    label: string;
}
export interface Activity {
    name: string;
    tags: Tag[];
}
export interface PayrollFinalizeInput {
    activities: Activity[];
    month?: number;
    year?: number;
    userId: string;
}
export interface EmployeeData {
    _id: string;
    fullName: string;
    monthlySalary: number;
    overtimeRate?: number;
}
export interface UserData {
    defaultDailyRate?: number;
    defaultOvertimeRate?: number;
}
export declare class PayrollService {
    /**
     * Helper: parse tag labels back into structured numbers
     */
    static parseTagValue(label: string): number;
    /**
     * Calculates salary adjustments for a given employee based on activities
     */
    static calculatePayroll(employee: EmployeeData, user: UserData | null, activity: Activity): {
        baseSalary: number;
        leaveDays: number;
        overtimeHours: number;
        bonus: number;
        deductions: number;
        leaveDeduction: number;
        overtimePay: number;
        netSalary: number;
        overtimeRate: number;
    };
}
//# sourceMappingURL=payroll.service.d.ts.map