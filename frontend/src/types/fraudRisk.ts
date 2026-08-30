export type RiskSeverity = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertCategory = 'VELOCITY' | 'LOCATION_ANOMALY' | 'DEVICE_SPOOFING' | 'IP_MISMATCH' | 'HIGH_VALUE_TXN' | 'BLACKLISTED_BIN' | 'MULTIPLE_FAILURES';
export type ActionStatus = 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface LocationData {
    ipAddress: string;
    country: string;
    city: string;
    asn: string;
    isVpnOrProxy: boolean;
    distanceFromBillingMiles?: number;
}

export interface DeviceData {
    deviceId: string;
    deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'UNKNOWN';
    os: string;
    browser: string;
    isEmulator: boolean;
    screenResolution: string;
}

export interface FraudAlert {
    id: string;
    timestamp: string;
    customerId: string;
    customerEmail: string;
    transactionId?: string;
    category: AlertCategory;
    severity: RiskSeverity;
    status: ActionStatus;
    riskScore: number; // 0 to 100
    location: LocationData;
    device: DeviceData;
    description: string;
    automatedActionTaken?: 'NONE' | 'TXN_BLOCKED' | 'ACCOUNT_FROZEN' | 'CHALLENGE_ISSUED';
}

export interface BlocklistEntry {
    id: string;
    type: 'IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID';
    value: string;
    addedAt: string;
    addedBy: string;
    reason: string;
    expiresAt?: string;
}

export interface RiskMatrixCell {
    xRange: [number, number]; // e.g., txn velocity
    yRange: [number, number]; // e.g., transaction amount
    density: number;
    averageRiskScore: number;
    alertIds: string[];
}

export interface FraudMetrics {
    totalAlerts24h: number;
    criticalAlerts24h: number;
    activeInvestigations: number;
    blockedTxnVolume: number; // Dollar amount blocked
    falsePositiveRate: number; // Percentage
    avgResolutionMinutes: number;
    topRiskVector: AlertCategory;
}

export interface ComprehensiveFraudPayload {
    alerts: FraudAlert[];
    metrics: FraudMetrics;
    blocklist: BlocklistEntry[];
    matrix: RiskMatrixCell[];
}

export interface BlocklistSubmitForm {
    type: 'IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID';
    value: string;
    reason: string;
    durationDays?: number;
}

// ─── Transaction Monitor Types ──────────────────────────────────────────────

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'DECLINED' | 'FLAGGED' | 'BLOCKED' | 'REVERSED';
export type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'CRYPTO' | 'ACH' | 'SWIFT';

export interface Transaction {
    id: string;
    timestamp: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    currency: string;
    merchantName: string;
    merchantCategory: string;
    paymentMethod: PaymentMethod;
    cardLast4?: string;
    status: TransactionStatus;
    riskScore: number;
    countryCode: string;
    ipAddress: string;
    deviceId: string;
    riskFlags: string[];
    authCode?: string;
    settled: boolean;
}

export interface TransactionFilters {
    search: string;
    status: TransactionStatus | 'ALL';
    paymentMethod: PaymentMethod | 'ALL';
    minAmount: number | null;
    maxAmount: number | null;
    riskThreshold: number | null;
    countryCode: string;
    dateFrom: string | null;
    dateTo: string | null;
}

export type TransactionSortField = 'timestamp' | 'amount' | 'riskScore' | 'status';
export type SortDirection = 'asc' | 'desc';

// ─── Alert Rules Engine Types ───────────────────────────────────────────────

export type RuleOperator = 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS' | 'IN_LIST' | 'BETWEEN';
export type RuleAction = 'BLOCK' | 'FLAG' | 'NOTIFY' | 'CHALLENGE' | 'FREEZE_ACCOUNT' | 'LOG_ONLY';
export type RuleMetric = 'RISK_SCORE' | 'TXN_AMOUNT' | 'VELOCITY_1H' | 'VELOCITY_24H' | 'DISTANCE_MILES' | 'FAILED_ATTEMPTS' | 'NEW_DEVICE' | 'VPN_DETECTED';

export interface FraudRuleCondition {
    id: string;
    metric: RuleMetric;
    operator: RuleOperator;
    value: string;
    valueSecondary?: string;
    connector: 'AND' | 'OR';
}

export interface FraudRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    category: AlertCategory;
    conditions: FraudRuleCondition[];
    actions: RuleAction[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    triggeredCount: number;
    lastTriggeredAt?: string;
}

// ─── Geographic Threat Types ────────────────────────────────────────────────

export interface GeoThreatCountry {
    code: string;
    name: string;
    threatLevel: number; // 0 to 100
    alertCount: number;
    blockedCount: number;
    topCategory: AlertCategory;
    riskScoreAvg: number;
    coordinates: { lat: number; lng: number };
}

export interface GeoThreatSummary {
    countries: GeoThreatCountry[];
    globalThreatIndex: number;
    totalBlockedCountries: number;
    topThreatOrigin: string;
    crossBorderAlerts: number;
    vpnProxyPercentage: number;
}

// ─── Customer Risk Profile Types ────────────────────────────────────────────

export type CustomerTier = 'STANDARD' | 'ELEVATED' | 'HIGH_RISK' | 'BLOCKED';

export interface CustomerRiskProfile {
    id: string;
    name: string;
    email: string;
    tier: CustomerTier;
    overallRiskScore: number;
    registrationDate: string;
    lastActivity: string;
    totalTransactions: number;
    totalTransactionVolume: number;
    alertCount: number;
    resolvedAlerts: number;
    openAlerts: number;
    blocklistHits: number;
    deviceCount: number;
    uniqueCountries: number;
    avgTransactionAmount: number;
    maxSingleTransaction: number;
    velocityScore: number;
    geoRiskScore: number;
    deviceRiskScore: number;
    behavioralScore: number;
    recentAlerts: FraudAlert[];
    riskTimeline: RiskTimelinePoint[];
    tags: string[];
    notes: string[];
}

export interface RiskTimelinePoint {
    date: string;
    score: number;
    event?: string;
}

// ─── Audit Trail Types ─────────────────────────────────────────────────────

export type AuditAction = 'ALERT_CREATED' | 'ALERT_ESCALATED' | 'ALERT_RESOLVED' | 'ALERT_FALSE_POSITIVE' | 'TXN_BLOCKED' | 'TXN_FLAGGED' | 'ACCOUNT_FROZEN' | 'ACCOUNT_UNFROZEN' | 'BLOCKLIST_ADD' | 'BLOCKLIST_REMOVE' | 'RULE_ENABLED' | 'RULE_DISABLED' | 'RULE_CREATED' | 'RULE_MODIFIED' | 'INVESTIGATION_STARTED' | 'INVESTIGATION_COMPLETED' | 'SETTINGS_CHANGED' | 'MANUAL_REVIEW';

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: AuditAction;
    actor: string;
    actorRole: string;
    targetType: 'ALERT' | 'TRANSACTION' | 'CUSTOMER' | 'BLOCKLIST' | 'RULE' | 'SYSTEM' | 'SETTINGS';
    targetId: string;
    targetDescription: string;
    details: string;
    previousValue?: string;
    newValue?: string;
    ipAddress: string;
    riskImpact?: number;
}

// ─── Risk Score Distribution Types ──────────────────────────────────────────

export interface RiskScoreBucket {
    range: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
    color: string;
}

export interface RiskDistribution {
    buckets: RiskScoreBucket[];
    totalTransactions: number;
    avgScore: number;
    medianScore: number;
    p95Score: number;
    trendData: TrendDataPoint[];
}

export interface TrendDataPoint {
    date: string;
    avgScore: number;
    alertCount: number;
    blockedCount: number;
}

// ─── Fraud Settings Types ──────────────────────────────────────────────────

export interface FraudSettings {
    globalThreshold: number;
    autoBlockThreshold: number;
    challengeThreshold: number;
    velocityWindowMinutes: number;
    maxVelocityPerWindow: number;
    geoRestrictionEnabled: boolean;
    restrictedCountries: string[];
    vpnBlockingEnabled: boolean;
    emulatorDetectionEnabled: boolean;
    emailVerificationRequired: boolean;
    threeDSecureEnabled: boolean;
    riskScoreAlgorithm: 'RULE_BASED' | 'ML_ENSEMBLE' | 'NEURAL_NETWORK';
    modelVersion: string;
    lastModelRetrainedAt: string;
    notificationWebhook: string;
    notificationEmails: string[];
    escalationAutoAssign: boolean;
    maxInvestigationHours: number;
}

export interface FraudDashboardTab {
    id: string;
    label: string;
    icon: string;
    count?: number;
}
