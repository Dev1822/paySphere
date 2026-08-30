// ──────────────────────────────────────────────────────────────────────────────
// Enterprise Stock Options & Equity Management (ESOP) Hub — Mock Service Layer
// ──────────────────────────────────────────────────────────────────────────────

import type {
    EquityPool, EquityGrant, VestingEvent, EsopKPIs, CapTableEntry
} from '../types/esopManagement';

const LATEST_FMV = 14.50; // Current Fair Market Value per share
const TOTAL_OUTSTANDING_SHARES = 10000000;

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateEquityPool(): EquityPool {
    const authorized = 1500000;
    const allocated = 1150000;
    return {
        poolName: '2024 Employee Stock Plan',
        totalAuthorizedShares: authorized,
        allocatedShares: allocated,
        availableShares: authorized - allocated,
        poolValueCurrent: authorized * LATEST_FMV,
        latest409AValuation: LATEST_FMV,
        fullyDilutedPercentage: (authorized / TOTAL_OUTSTANDING_SHARES) * 100,
    };
}

export function generateEquityGrants(count = 50): EquityGrant[] {
    const firstNames = ['James', 'Amit', 'Sarah', 'Kavita', 'Michael', 'Chloe', 'Liam', 'Ananya'];
    return Array.from({ length: count }, (_, i) => {
        const isRsu = Math.random() > 0.6;
        const shares = rng(1000, 25000);
        const vestedPct = rng(0, 100) / 100;
        const vested = Math.floor(shares * vestedPct);
        const strike = isRsu ? 0 : [1.2, 3.4, 5.5, 7.8, 10.0][rng(0, 4)];

        // Value of options = (FMV - Strike) * Shares. Value of RSUs = FMV * Shares.
        const perShareProfit = Math.max(0, LATEST_FMV - strike);

        return {
            grantId: `GR-2024-${1000 + i}`,
            employeeName: `${pick(firstNames)} ${pick(['O.', 'S.', 'M.', 'P.', 'K.'])}`,
            role: pick(['Senior Engineer', 'Product Manager', 'Account Exec', 'Designer', 'Data Scientist']),
            department: pick(['Engineering', 'Product', 'Sales', 'Design', 'Data']),
            grantType: isRsu ? 'RSU' : pick(['ISO', 'NSO']),
            sharesGranted: shares,
            sharesVested: vested,
            strikePrice: strike,
            grantDate: new Date(Date.now() - rng(100, 1000) * 86400000).toISOString().split('T')[0],
            vestingStartDate: new Date(Date.now() - rng(100, 1000) * 86400000).toISOString().split('T')[0],
            scheduleType: pick(['STANDARD_4_YEAR_1_YEAR_CLIFF', 'MONTHLY_NO_CLIFF']),
            status: vested === shares ? 'FULLY_VESTED' : 'ISSUED',
            currentValueTotal: shares * perShareProfit,
            currentValueVested: vested * perShareProfit,
        };
    });
}

export function generateVestingEvents(): VestingEvent[] {
    return Array.from({ length: 8 }, (_, i) => ({
        eventId: `EV-${100 + i}`,
        date: new Date(Date.now() + rng(1, 30) * 86400000).toISOString().split('T')[0],
        employeeName: `Participant ${rng(1, 100)}`,
        sharesVesting: rng(100, 1250),
        eventType: pick(['CLIFF_VEST', 'MONTHLY_VEST', 'QUARTERLY_VEST']),
        valueLiquidated: 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function generateCapTable(): CapTableEntry[] {
    return [
        { investorClass: 'FOUNDERS', sharesHeld: 4000000, ownershipPercentage: 40 },
        { investorClass: 'VC_SEED', sharesHeld: 1500000, ownershipPercentage: 15 },
        { investorClass: 'VC_SERIES_A', sharesHeld: 2500000, ownershipPercentage: 25 },
        { investorClass: 'EMPLOYEE_POOL', sharesHeld: 1500000, ownershipPercentage: 15 },
        { investorClass: 'ADVISORS', sharesHeld: 500000, ownershipPercentage: 5 },
    ];
}

export function computeEsopKPIs(pool: EquityPool, grants: EquityGrant[], events: VestingEvent[]): EsopKPIs {
    const totalUnvested = grants.reduce((sum, g) => sum + (g.currentValueTotal - g.currentValueVested), 0);
    return {
        totalParticipants: grants.length,
        totalSharesOutstanding: pool.allocatedShares,
        upcomingVestsNext30Days: events.length,
        poolDepletionWarning: (pool.availableShares / pool.totalAuthorizedShares) < 0.1,
        totalUnvestedValue: totalUnvested,
        averageStakePerEmployee: Math.floor(pool.allocatedShares / grants.length)
    };
}
