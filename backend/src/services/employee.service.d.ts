export interface EmployeeCreateInput {
    fullName: string;
    role?: string;
    monthlySalary: number;
    overtimeRate?: number;
    companyName: string;
    createdBy: string;
}
export declare class EmployeeService {
    /**
     * Constructs the employee document object.
     * Business logic can be expanded here (e.g., auto-generating employee IDs).
     */
    static createEmployeePayload(input: EmployeeCreateInput): {
        fullName: string;
        role: string;
        monthlySalary: number;
        overtimeRate: number;
        companyName: string;
        createdBy: string;
    };
}
//# sourceMappingURL=employee.service.d.ts.map