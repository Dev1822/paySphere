// ──────────────────────────────────────────────────────────────────────────────
// Enterprise Stock Options & Equity Management (ESOP) Hub — TypeScript Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export type GrantType = 'ISO' | 'NSO' | 'RSU' | 'PERFORMANCE_SHARES';
export type VestingScheduleType = 'STANDARD_4_YEAR_1_YEAR_CLIFF' | 'MONTHLY_NO_CLIFF' | 'MILESTONE_BASED' | 'CUSTOM';
export type GrantStatus = 'PENDING_BOARD_APPROVAL' | 'ISSUED' | 'FULLY_VESTED' | 'CANCELLED';

export interface EquityPool {
    poolName: string;
    totalAuthorizedShares: number;
    allocatedShares: number;
    availableShares: number;
    poolValueCurrent: number; // Based on latest 409A / FMV
    latest409AValuation: number;
    fullyDilutedPercentage: number;
}

export interface EquityGrant {
    grantId: string;
    employeeName: string;
    role: string;
    department: string;
    grantType: GrantType;
    sharesGranted: number;
    sharesVested: number;
    strikePrice: number; // 0 for RSUs
    grantDate: string; // ISO String
    vestingStartDate: string;
    scheduleType: VestingScheduleType;
    status: GrantStatus;
    currentValueTotal: number;
    currentValueVested: number;
}

export interface VestingEvent {
    eventId: string;
    date: string; // Date of vest
    employeeName: string;
    sharesVesting: number;
    eventType: 'CLIFF_VEST' | 'MONTHLY_VEST' | 'QUARTERLY_VEST';
    valueLiquidated: number; // If any shares were sold for taxes, etc. (Mocked as 0 usually here)
}

export interface EsopKPIs {
    totalParticipants: number;
    totalSharesOutstanding: number;
    upcomingVestsNext30Days: number;
    poolDepletionWarning: boolean;
    totalUnvestedValue: number;
    averageStakePerEmployee: number;
}

export interface CapTableEntry {
    investorClass: 'FOUNDERS' | 'VC_SEED' | 'VC_SERIES_A' | 'EMPLOYEE_POOL' | 'ADVISORS';
    sharesHeld: number;
    ownershipPercentage: number;
}
