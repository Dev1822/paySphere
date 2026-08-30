export interface BenefitEnrollmentDTO {
    enrollmentId: string;
    employeeId: string;
    planId: string;
    selectedTier: string;
    monthlyDeductionUSD: number;
    isEDITransmitted: boolean;
}
export declare class EnterpriseBenefitsModel {
    planId: string;
    planName: string;
    carrierProvider: string;
    category: 'Medical' | 'Dental' | 'Vision' | '401k' | 'LifeInsurance';
    employerContributionUSD: number;
    employeeDeductionUSD: number;
    enrolledCount: number;
    annualDeductibleUSD: number;
    activeEnrollments: BenefitEnrollmentDTO[];
    isERISACompliant: boolean;
    createdAt: string;
    constructor(data: Partial<EnterpriseBenefitsModel>);
    toJSON(): {
        planId: string;
        planName: string;
        carrierProvider: string;
        category: "401k" | "Dental" | "LifeInsurance" | "Medical" | "Vision";
        employerContributionUSD: number;
        employeeDeductionUSD: number;
        enrolledCount: number;
        annualDeductibleUSD: number;
        activeEnrollments: BenefitEnrollmentDTO[];
        isERISACompliant: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=EnterpriseBenefitsModel.d.ts.map