export type TravelStatus = 'draft' | 'pending_approval' | 'approved' | 'booked' | 'in_progress' | 'completed' | 'denied' | 'cancelled';
export type ExpenseCategory = 'airfare' | 'hotel' | 'ground_transport' | 'meals' | 'client_entertainment' | 'conference' | 'office_supplies' | 'mileage' | 'miscellaneous';
export type TripType = 'domestic' | 'international' | 'conference' | 'client_visit' | 'training' | 'relocation';
export type PaymentMethod = 'corporate_card' | 'personal_card' | 'cash_advance' | 'direct_bill';
export type ApprovalPriority = 'standard' | 'expedited' | 'urgent';
export interface ITravelRequest {
    id: string;
    requestId: string;
    employeeId: string;
    employeeName: string;
    department: string;
    tripType: TripType;
    purpose: string;
    destination: {
        city: string;
        country: string;
        region: string;
    };
    departureDate: string;
    returnDate: string;
    estimatedCost: {
        flights: number;
        hotel: number;
        ground: number;
        meals: number;
        total: number;
    };
    status: TravelStatus;
    priority: ApprovalPriority;
    approvedBy: string | null;
    approvedAt: string | null;
    bookingRef: string | null;
    complianceFlags: string[];
    createdAt: string;
}
export interface IExpenseReport {
    id: string;
    reportNumber: string;
    employeeId: string;
    employeeName: string;
    department: string;
    travelRequestId: string | null;
    title: string;
    period: {
        start: string;
        end: string;
    };
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'reimbursed' | 'rejected';
    lineItems: Array<{
        id: string;
        date: string;
        category: ExpenseCategory;
        description: string;
        amount: number;
        currency: string;
        receiptAttached: boolean;
        mileage: number | null;
        isCompliant: boolean;
        notes: string;
    }>;
    subtotal: number;
    taxReclaimable: number;
    totalAmount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    submittedAt: string | null;
    reviewedBy: string | null;
    reimbursedAt: string | null;
    complianceScore: number;
}
export interface IPerDiemRate {
    id: string;
    location: string;
    country: string;
    region: string;
    currency: string;
    rates: {
        lodging: number;
        meals: number;
        incidentals: number;
        total: number;
    };
    effectiveDate: string;
    source: string;
    isHighCost: boolean;
    notes: string;
}
export interface ITravelAnalytics {
    period: string;
    totalTrips: number;
    totalSpend: number;
    averageTripCost: number;
    topDestinations: Array<{
        city: string;
        trips: number;
        spend: number;
    }>;
    spendByCategory: Array<{
        category: ExpenseCategory;
        amount: number;
        percentage: number;
    }>;
    departmentSpend: Array<{
        department: string;
        trips: number;
        spend: number;
    }>;
    complianceRate: number;
    advanceBookingRate: number;
    policyViolations: number;
}
export declare function createMockTravelRequests(): ITravelRequest[];
export declare function createMockExpenseReports(): IExpenseReport[];
export declare function createMockPerDiemRates(): IPerDiemRate[];
export declare function computeDepartmentSpend(requests: ITravelRequest[]): Array<{
    department: string;
    trips: number;
    totalSpend: number;
}>;
export declare function computeTopDestinations(requests: ITravelRequest[]): Array<{
    city: string;
    country: string;
    trips: number;
    totalSpend: number;
}>;
//# sourceMappingURL=EnterpriseTravelModel.d.ts.map