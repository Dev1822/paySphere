import {
    FraudAlert,
    BlocklistEntry,
    RiskMatrixCell,
    ComprehensiveFraudPayload,
    RiskSeverity,
    AlertCategory,
    ActionStatus,
    BlocklistSubmitForm,
    Transaction,
    TransactionStatus,
    PaymentMethod,
    TransactionFilters,
    TransactionSortField,
    SortDirection,
    FraudRule,
    FraudRuleCondition,
    RuleAction,
    RuleMetric,
    RuleOperator,
    GeoThreatSummary,
    GeoThreatCountry,
    CustomerRiskProfile,
    CustomerTier,
    AuditLogEntry,
    AuditAction,
    RiskDistribution,
    RiskScoreBucket,
    TrendDataPoint,
    FraudSettings,
} from '../types/fraudRisk';

class FraudRiskServiceAPI {
    private alertsDataset: FraudAlert[] = [];
    private blocklistDataset: BlocklistEntry[] = [];
    private transactionsDataset: Transaction[] = [];
    private rulesDataset: FraudRule[] = [];
    private customersDataset: CustomerRiskProfile[] = [];
    private auditDataset: AuditLogEntry[] = [];

    constructor() {
        this.hydrateMockData();
    }

    private hydrateMockData() {
        const severities: RiskSeverity[] = ['SAFE', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL'];
        const categories: AlertCategory[] = ['VELOCITY', 'LOCATION_ANOMALY', 'DEVICE_SPOOFING', 'IP_MISMATCH', 'HIGH_VALUE_TXN', 'BLACKLISTED_BIN', 'MULTIPLE_FAILURES'];
        const statuses: ActionStatus[] = ['OPEN', 'OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'FALSE_POSITIVE'];

        // Generate 500 alerts for realism
        for (let i = 0; i < 500; i++) {
            const sev = severities[Math.floor(Math.random() * severities.length)];
            const riskScore = sev === 'CRITICAL' ? 90 + Math.random() * 10 : sev === 'HIGH' ? 70 + Math.random() * 20 : sev === 'MEDIUM' ? 40 + Math.random() * 30 : Math.random() * 40;

            this.alertsDataset.push({
                id: `f_alert_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                customerId: `cus_${Math.floor(Math.random() * 99999)}`,
                customerEmail: `user_${Math.floor(Math.random() * 9999)}@example.com`,
                transactionId: Math.random() > 0.3 ? `txn_${Math.random().toString(36).substr(2, 9)}` : undefined,
                category: categories[Math.floor(Math.random() * categories.length)],
                severity: sev,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                riskScore,
                location: {
                    ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0`,
                    country: Math.random() > 0.7 ? 'RU' : Math.random() > 0.4 ? 'NG' : 'US',
                    city: 'Unknown Routing',
                    asn: `AS${Math.floor(Math.random() * 9999)}`,
                    isVpnOrProxy: Math.random() > 0.6,
                    distanceFromBillingMiles: Math.floor(Math.random() * 5000)
                },
                device: {
                    deviceId: `dev_${Math.random().toString(36).substr(2, 8)}`,
                    deviceType: Math.random() > 0.5 ? 'MOBILE' : 'DESKTOP',
                    os: 'Windows 10',
                    browser: 'Chrome 110',
                    isEmulator: Math.random() > 0.9,
                    screenResolution: '1920x1080'
                },
                description: `Suspicious activity detected triggering automated risk vectors.`,
                automatedActionTaken: sev === 'CRITICAL' ? 'TXN_BLOCKED' : sev === 'HIGH' ? 'CHALLENGE_ISSUED' : 'NONE'
            });
        }

        this.alertsDataset.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Blocklist Data
        const types: ('IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID')[] = ['IP', 'EMAIL', 'CARD_BIN', 'DEVICE_ID'];
        for (let i = 0; i < 30; i++) {
            const bType = types[Math.floor(Math.random() * 4)];
            this.blocklistDataset.push({
                id: `blk_${Math.random().toString(36).substr(2, 9)}`,
                type: bType,
                value: bType === 'IP' ? '185.192.x.x' : bType === 'EMAIL' ? '*@suspicious.biz' : bType === 'CARD_BIN' ? '411111' : 'dev_xyz123',
                addedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                addedBy: 'admin_sys',
                reason: 'Repeated authorization failures and card testing.',
                expiresAt: Math.random() > 0.5 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
            });
        }

        // ─── Transaction Data ──────────────────────────────────────────────
        const txStatuses: TransactionStatus[] = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'FLAGGED', 'BLOCKED', 'DECLINED', 'REVERSED'];
        const paymentMethods: PaymentMethod[] = ['CARD', 'CARD', 'BANK_TRANSFER', 'WALLET', 'CRYPTO', 'ACH', 'SWIFT'];
        const countries = ['US', 'US', 'US', 'GB', 'DE', 'FR', 'RU', 'NG', 'BR', 'IN', 'JP', 'AU', 'CA', 'MX', 'KR'];
        const merchants = ['Amazon', 'Walmart', 'Target', 'Best Buy', 'Apple Store', 'Netflix', 'Spotify', 'Steam', 'PayPal', 'Stripe', 'Unknown Merchant', 'Suspicious Exchange', 'Offshore Transfer', 'Gift Card Vendor', 'VPN Service'];
        const merchantCategories = ['RETAIL', 'DIGITAL_GOODS', 'GAMING', 'CRYPTO_EXCHANGE', 'TRAVEL', 'FOOD', 'SERVICES', 'WIRE_TRANSFER'];

        const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Ahmed', 'Yuki', 'Carlos', 'Priya', 'Dmitri', 'Chen', 'Fatima', 'Olga'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Khan', 'Tanaka', 'Silva', 'Singh', 'Petrov', 'Wang', 'Ali', 'Ivanov', 'Kim', 'Mueller'];

        for (let i = 0; i < 800; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const status = txStatuses[Math.floor(Math.random() * txStatuses.length)];
            const amount = Math.random() > 0.95 ? 5000 + Math.random() * 45000 : Math.random() > 0.8 ? 500 + Math.random() * 4500 : 1 + Math.random() * 500;
            const riskScore = status === 'BLOCKED' ? 85 + Math.random() * 15 : status === 'FLAGGED' ? 60 + Math.random() * 25 : Math.random() * 50;
            const country = countries[Math.floor(Math.random() * countries.length)];

            const riskFlags: string[] = [];
            if (riskScore > 70) riskFlags.push('HIGH_RISK_SCORE');
            if (amount > 5000) riskFlags.push('HIGH_VALUE');
            if (country === 'RU' || country === 'NG') riskFlags.push('SANCTIONED_REGION');
            if (Math.random() > 0.7) riskFlags.push('NEW_DEVICE');
            if (Math.random() > 0.8) riskFlags.push('VPN_DETECTED');
            if (Math.random() > 0.9) riskFlags.push('VELOCITY_BURST');
            if (Math.random() > 0.85) riskFlags.push('GEO_MISMATCH');

            this.transactionsDataset.push({
                id: `txn_${Math.random().toString(36).substr(2, 12)}`,
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                customerId: `cus_${Math.floor(Math.random() * 99999)}`,
                customerName: `${firstName} ${lastName}`,
                customerEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
                amount: Math.round(amount * 100) / 100,
                currency: 'USD',
                merchantName: merchants[Math.floor(Math.random() * merchants.length)],
                merchantCategory: merchantCategories[Math.floor(Math.random() * merchantCategories.length)],
                paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                cardLast4: Math.random() > 0.3 ? `${Math.floor(1000 + Math.random() * 9000)}` : undefined,
                status,
                riskScore: Math.round(riskScore * 10) / 10,
                countryCode: country,
                ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                deviceId: `dev_${Math.random().toString(36).substr(2, 8)}`,
                riskFlags,
                authCode: Math.random() > 0.5 ? `AUTH${Math.floor(Math.random() * 999999)}` : undefined,
                settled: status === 'COMPLETED',
            });
        }

        this.transactionsDataset.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // ─── Rules Data ────────────────────────────────────────────────────
        this.rulesDataset = this.generateDefaultRules();

        // ─── Customer Risk Profiles ────────────────────────────────────────
        this.customersDataset = this.generateCustomerProfiles();

        // ─── Audit Trail ───────────────────────────────────────────────────
        this.auditDataset = this.generateAuditTrail();
    }

    private generateDefaultRules(): FraudRule[] {
        const rules: FraudRule[] = [
            {
                id: 'rule_001', name: 'High Value Transaction Block', description: 'Block transactions exceeding $10,000 from high-risk regions',
                enabled: true, priority: 1, category: 'HIGH_VALUE_TXN',
                conditions: [
                    { id: 'c1', metric: 'TXN_AMOUNT', operator: 'GREATER_THAN', value: '10000', connector: 'AND' },
                    { id: 'c2', metric: 'RISK_SCORE', operator: 'GREATER_THAN', value: '70', connector: 'AND' },
                ],
                actions: ['BLOCK', 'NOTIFY'],
                createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'admin@paysphere.io',
                triggeredCount: 342,
                lastTriggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_002', name: 'Velocity Burst Detection', description: 'Flag accounts with >10 transactions in 1 hour',
                enabled: true, priority: 2, category: 'VELOCITY',
                conditions: [
                    { id: 'c3', metric: 'VELOCITY_1H', operator: 'GREATER_THAN', value: '10', connector: 'AND' },
                ],
                actions: ['FLAG', 'CHALLENGE'],
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'admin@paysphere.io',
                triggeredCount: 1247,
                lastTriggeredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_003', name: 'VPN + New Device Challenge', description: 'Challenge transactions from VPN with new device fingerprint',
                enabled: true, priority: 3, category: 'DEVICE_SPOOFING',
                conditions: [
                    { id: 'c4', metric: 'VPN_DETECTED', operator: 'EQUALS', value: 'true', connector: 'AND' },
                    { id: 'c5', metric: 'NEW_DEVICE', operator: 'EQUALS', value: 'true', connector: 'AND' },
                ],
                actions: ['CHALLENGE', 'LOG_ONLY'],
                createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'fraud_team_lead@paysphere.io',
                triggeredCount: 856,
                lastTriggeredAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_004', name: 'Geo-Distance Anomaly', description: 'Flag when billing-to-IP distance exceeds 5000 miles',
                enabled: true, priority: 4, category: 'LOCATION_ANOMALY',
                conditions: [
                    { id: 'c6', metric: 'DISTANCE_MILES', operator: 'GREATER_THAN', value: '5000', connector: 'AND' },
                ],
                actions: ['FLAG', 'NOTIFY'],
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'admin@paysphere.io',
                triggeredCount: 2103,
                lastTriggeredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_005', name: 'Multiple Failed Auth Lockout', description: 'Freeze account after 5 consecutive failed authorizations',
                enabled: false, priority: 5, category: 'MULTIPLE_FAILURES',
                conditions: [
                    { id: 'c7', metric: 'FAILED_ATTEMPTS', operator: 'GREATER_THAN', value: '5', connector: 'AND' },
                ],
                actions: ['FREEZE_ACCOUNT', 'NOTIFY'],
                createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'fraud_team_lead@paysphere.io',
                triggeredCount: 89,
                lastTriggeredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_006', name: 'IP Blocklist Enforcement', description: 'Auto-block transactions from known blacklisted IPs',
                enabled: true, priority: 1, category: 'IP_MISMATCH',
                conditions: [
                    { id: 'c8', metric: 'RISK_SCORE', operator: 'GREATER_THAN', value: '90', connector: 'AND' },
                ],
                actions: ['BLOCK', 'LOG_ONLY'],
                createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'admin@paysphere.io',
                triggeredCount: 4201,
                lastTriggeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_007', name: 'BIN Range Suspicious', description: 'Flag cards from known fraud BIN ranges',
                enabled: true, priority: 3, category: 'BLACKLISTED_BIN',
                conditions: [
                    { id: 'c9', metric: 'RISK_SCORE', operator: 'BETWEEN', value: '60', valueSecondary: '80', connector: 'AND' },
                    { id: 'c10', metric: 'VELOCITY_24H', operator: 'GREATER_THAN', value: '3', connector: 'AND' },
                ],
                actions: ['FLAG', 'NOTIFY'],
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'fraud_team_lead@paysphere.io',
                triggeredCount: 567,
                lastTriggeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: 'rule_008', name: 'Weekend Night Risk Escalation', description: 'Escalate all HIGH risk alerts during weekend nights',
                enabled: true, priority: 6, category: 'LOCATION_ANOMALY',
                conditions: [
                    { id: 'c11', metric: 'RISK_SCORE', operator: 'GREATER_THAN', value: '75', connector: 'AND' },
                ],
                actions: ['NOTIFY', 'LOG_ONLY'],
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'admin@paysphere.io',
                triggeredCount: 198,
                lastTriggeredAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            },
        ];
        return rules;
    }

    private generateCustomerProfiles(): CustomerRiskProfile[] {
        const profiles: CustomerRiskProfile[] = [];
        const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Ahmed', 'Yuki', 'Carlos', 'Priya', 'Dmitri', 'Fatima', 'Olga', 'Chen'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Garcia', 'Khan', 'Tanaka', 'Silva', 'Singh', 'Petrov', 'Ali', 'Wang', 'Mueller', 'Ivanov'];
        const tiers: CustomerTier[] = ['STANDARD', 'STANDARD', 'STANDARD', 'ELEVATED', 'ELEVATED', 'HIGH_RISK', 'BLOCKED'];

        for (let i = 0; i < 50; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const tier = tiers[Math.floor(Math.random() * tiers.length)];
            const overallRiskScore = tier === 'BLOCKED' ? 90 + Math.random() * 10 : tier === 'HIGH_RISK' ? 70 + Math.random() * 20 : tier === 'ELEVATED' ? 40 + Math.random() * 30 : Math.random() * 40;

            const riskTimeline = [];
            for (let d = 30; d >= 0; d--) {
                riskTimeline.push({
                    date: new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    score: Math.max(0, Math.min(100, overallRiskScore + (Math.random() - 0.5) * 30)),
                    event: d === 0 ? 'Current' : Math.random() > 0.9 ? 'ALERT_RAISED' : undefined,
                });
            }

            const alertCount = Math.floor(Math.random() * 20);
            const resolvedAlerts = Math.floor(alertCount * (0.3 + Math.random() * 0.5));

            const tags: string[] = [];
            if (tier === 'BLOCKED') tags.push('BLOCKED_ACCOUNT', 'FRAUD_CONFIRMED');
            if (tier === 'HIGH_RISK') tags.push('UNDER_REVIEW');
            if (overallRiskScore > 60) tags.push('VELOCITY_CONCERN');
            if (Math.random() > 0.7) tags.push('VPN_USER');
            if (Math.random() > 0.8) tags.push('MULTI_COUNTRY');

            profiles.push({
                id: `cus_${Math.floor(Math.random() * 99999)}`,
                name: `${firstName} ${lastName}`,
                email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
                tier,
                overallRiskScore: Math.round(overallRiskScore * 10) / 10,
                registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                totalTransactions: Math.floor(10 + Math.random() * 500),
                totalTransactionVolume: Math.round((100 + Math.random() * 50000) * 100) / 100,
                alertCount,
                resolvedAlerts,
                openAlerts: alertCount - resolvedAlerts,
                blocklistHits: Math.floor(Math.random() * 5),
                deviceCount: Math.floor(1 + Math.random() * 8),
                uniqueCountries: Math.floor(1 + Math.random() * 12),
                avgTransactionAmount: Math.round((50 + Math.random() * 2000) * 100) / 100,
                maxSingleTransaction: Math.round((500 + Math.random() * 30000) * 100) / 100,
                velocityScore: Math.round(Math.random() * 100 * 10) / 10,
                geoRiskScore: Math.round(Math.random() * 100 * 10) / 10,
                deviceRiskScore: Math.round(Math.random() * 100 * 10) / 10,
                behavioralScore: Math.round(Math.random() * 100 * 10) / 10,
                recentAlerts: this.alertsDataset.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').slice(0, 3),
                riskTimeline,
                tags,
                notes: Math.random() > 0.5 ? ['Reviewed on ' + new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()] : [],
            });
        }

        return profiles;
    }

    private generateAuditTrail(): AuditLogEntry[] {
        const actions: AuditAction[] = [
            'ALERT_CREATED', 'ALERT_ESCALATED', 'ALERT_RESOLVED', 'ALERT_FALSE_POSITIVE',
            'TXN_BLOCKED', 'TXN_FLAGGED', 'ACCOUNT_FROZEN', 'ACCOUNT_UNFROZEN',
            'BLOCKLIST_ADD', 'BLOCKLIST_REMOVE', 'RULE_ENABLED', 'RULE_DISABLED',
            'INVESTIGATION_STARTED', 'INVESTIGATION_COMPLETED', 'SETTINGS_CHANGED', 'MANUAL_REVIEW',
        ];
        const actors = ['admin@paysphere.io', 'fraud_analyst_1@paysphere.io', 'fraud_team_lead@paysphere.io', 'system_auto', 'api_cron_worker'];
        const roles = ['ADMIN', 'ANALYST', 'LEAD', 'SYSTEM', 'SYSTEM'];
        const targetTypes: ('ALERT' | 'TRANSACTION' | 'CUSTOMER' | 'BLOCKLIST' | 'RULE' | 'SYSTEM')[] = ['ALERT', 'TRANSACTION', 'CUSTOMER', 'BLOCKLIST', 'RULE', 'SYSTEM'];

        const entries: AuditLogEntry[] = [];

        for (let i = 0; i < 200; i++) {
            const actionIdx = Math.floor(Math.random() * actions.length);
            const action = actions[actionIdx];
            const actorIdx = Math.floor(Math.random() * actors.length);
            const targetType = targetTypes[Math.floor(Math.random() * targetTypes.length)];

            const descriptions: Record<AuditAction, string> = {
                ALERT_CREATED: `New fraud alert triggered for ${targetType.toLowerCase()}`,
                ALERT_ESCALATED: `Alert escalated to senior review team`,
                ALERT_RESOLVED: `Alert marked as resolved after investigation`,
                ALERT_FALSE_POSITIVE: `Alert dismissed as false positive`,
                TXN_BLOCKED: `Transaction blocked by automated rule engine`,
                TXN_FLAGGED: `Transaction flagged for manual review`,
                ACCOUNT_FROZEN: `Customer account frozen due to high risk`,
                ACCOUNT_UNFROZEN: `Customer account unfrozen after clearance`,
                BLOCKLIST_ADD: `New entry added to global blocklist`,
                BLOCKLIST_REMOVE: `Entry removed from global blocklist`,
                RULE_ENABLED: `Fraud detection rule activated`,
                RULE_DISABLED: `Fraud detection rule deactivated`,
                RULE_CREATED: `New fraud detection rule created`,
                RULE_MODIFIED: `Fraud detection rule configuration updated`,
                INVESTIGATION_STARTED: `Manual investigation initiated`,
                INVESTIGATION_COMPLETED: `Investigation completed and documented`,
                SETTINGS_CHANGED: `Global fraud settings modified`,
                MANUAL_REVIEW: `Manual review requested for flagged item`,
            };

            entries.push({
                id: `audit_${Math.random().toString(36).substr(2, 10)}`,
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                action,
                actor: actors[actorIdx],
                actorRole: roles[actorIdx],
                targetType,
                targetId: `${targetType.toLowerCase()}_${Math.random().toString(36).substr(2, 6)}`,
                targetDescription: descriptions[action],
                details: `Automated ${action.toLowerCase().replace(/_/g, ' ')} event logged by ${actors[actorIdx].split('@')[0]}.`,
                previousValue: action.includes('ENABLED') || action.includes('DISABLED') ? (Math.random() > 0.5 ? 'true' : 'false') : undefined,
                newValue: action.includes('ENABLED') || action.includes('DISABLED') ? (Math.random() > 0.5 ? 'true' : 'false') : undefined,
                ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                riskImpact: Math.random() > 0.5 ? Math.round((Math.random() - 0.5) * 20 * 10) / 10 : undefined,
            });
        }

        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return entries;
    }

    // ─── Dashboard Data ──────────────────────────────────────────────────

    public async getDashboardData(): Promise<ComprehensiveFraudPayload> {
        await new Promise(r => setTimeout(r, 600));

        const now = Date.now();
        const alerts24h = this.alertsDataset.filter(a => now - new Date(a.timestamp).getTime() < 24 * 60 * 60 * 1000);

        // Matrix generation
        const matrix: RiskMatrixCell[] = [];
        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                matrix.push({
                    xRange: [x * 20, (x + 1) * 20],
                    yRange: [y * 20, (y + 1) * 20],
                    density: Math.floor(Math.random() * 50),
                    averageRiskScore: (x + y) * 10 + Math.random() * 20,
                    alertIds: []
                });
            }
        }

        return {
            alerts: this.alertsDataset.slice(0, 50),
            metrics: {
                totalAlerts24h: alerts24h.length,
                criticalAlerts24h: alerts24h.filter(a => a.severity === 'CRITICAL').length,
                activeInvestigations: this.alertsDataset.filter(a => a.status === 'INVESTIGATING' || a.status === 'ESCALATED').length,
                blockedTxnVolume: 125430.50,
                falsePositiveRate: 12.4,
                avgResolutionMinutes: 45.2,
                topRiskVector: 'LOCATION_ANOMALY'
            },
            blocklist: this.blocklistDataset.slice(0, 15),
            matrix
        };
    }

    // ─── Blocklist ───────────────────────────────────────────────────────

    public async addToBlocklist(form: BlocklistSubmitForm): Promise<BlocklistEntry> {
        await new Promise(r => setTimeout(r, 800));
        const entry: BlocklistEntry = {
            id: `blk_${Math.random().toString(36).substr(2, 9)}`,
            type: form.type,
            value: form.value,
            addedAt: new Date().toISOString(),
            addedBy: 'current_user',
            reason: form.reason,
            expiresAt: form.durationDays ? new Date(Date.now() + form.durationDays * 24 * 60 * 60 * 1000).toISOString() : undefined
        };
        this.blocklistDataset.unshift(entry);
        return entry;
    }

    // ─── Transactions ────────────────────────────────────────────────────

    public async getTransactions(
        filters: TransactionFilters,
        sortField: TransactionSortField,
        sortDir: SortDirection,
        page: number,
        pageSize: number
    ): Promise<{ transactions: Transaction[]; total: number; pages: number }> {
        await new Promise(r => setTimeout(r, 400));

        let filtered = [...this.transactionsDataset];

        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(t =>
                t.id.toLowerCase().includes(q) ||
                t.customerName.toLowerCase().includes(q) ||
                t.customerEmail.toLowerCase().includes(q) ||
                t.merchantName.toLowerCase().includes(q) ||
                t.customerId.toLowerCase().includes(q)
            );
        }
        if (filters.status !== 'ALL') filtered = filtered.filter(t => t.status === filters.status);
        if (filters.paymentMethod !== 'ALL') filtered = filtered.filter(t => t.paymentMethod === filters.paymentMethod);
        if (filters.minAmount !== null) filtered = filtered.filter(t => t.amount >= filters.minAmount!);
        if (filters.maxAmount !== null) filtered = filtered.filter(t => t.amount <= filters.maxAmount!);
        if (filters.riskThreshold !== null) filtered = filtered.filter(t => t.riskScore >= filters.riskThreshold!);
        if (filters.countryCode) filtered = filtered.filter(t => t.countryCode === filters.countryCode);
        if (filters.dateFrom) filtered = filtered.filter(t => new Date(t.timestamp) >= new Date(filters.dateFrom!));
        if (filters.dateTo) filtered = filtered.filter(t => new Date(t.timestamp) <= new Date(filters.dateTo!));

        filtered.sort((a, b) => {
            let aVal: number, bVal: number;
            if (sortField === 'timestamp') {
                aVal = new Date(a.timestamp).getTime();
                bVal = new Date(b.timestamp).getTime();
            } else if (sortField === 'amount') {
                aVal = a.amount;
                bVal = b.amount;
            } else if (sortField === 'riskScore') {
                aVal = a.riskScore;
                bVal = b.riskScore;
            } else {
                const statusOrder = { 'BLOCKED': 0, 'DECLINED': 1, 'FLAGGED': 2, 'REVERSED': 3, 'PENDING': 4, 'COMPLETED': 5 };
                aVal = statusOrder[a.status] ?? 5;
                bVal = statusOrder[b.status] ?? 5;
            }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        const total = filtered.length;
        const pages = Math.ceil(total / pageSize);
        const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

        return { transactions: paged, total, pages };
    }

    // ─── Rules ───────────────────────────────────────────────────────────

    public async getRules(): Promise<FraudRule[]> {
        await new Promise(r => setTimeout(r, 300));
        return [...this.rulesDataset];
    }

    public async toggleRule(ruleId: string, enabled: boolean): Promise<FraudRule> {
        await new Promise(r => setTimeout(r, 500));
        const rule = this.rulesDataset.find(r => r.id === ruleId);
        if (!rule) throw new Error('Rule not found');
        rule.enabled = enabled;
        rule.updatedAt = new Date().toISOString();
        return { ...rule };
    }

    public async createRule(rule: Omit<FraudRule, 'id' | 'createdAt' | 'updatedAt' | 'triggeredCount'>): Promise<FraudRule> {
        await new Promise(r => setTimeout(r, 600));
        const newRule: FraudRule = {
            ...rule,
            id: `rule_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            triggeredCount: 0,
        };
        this.rulesDataset.unshift(newRule);
        return newRule;
    }

    public async deleteRule(ruleId: string): Promise<void> {
        await new Promise(r => setTimeout(r, 400));
        this.rulesDataset = this.rulesDataset.filter(r => r.id !== ruleId);
    }

    // ─── Geographic Threats ──────────────────────────────────────────────

    public async getGeoThreats(): Promise<GeoThreatSummary> {
        await new Promise(r => setTimeout(r, 500));

        const countryData: GeoThreatCountry[] = [
            { code: 'RU', name: 'Russia', threatLevel: 92, alertCount: 1847, blockedCount: 423, topCategory: 'IP_MISMATCH', riskScoreAvg: 81.2, coordinates: { lat: 61.52, lng: 105.31 } },
            { code: 'NG', name: 'Nigeria', threatLevel: 78, alertCount: 1203, blockedCount: 312, topCategory: 'BLACKLISTED_BIN', riskScoreAvg: 72.4, coordinates: { lat: 9.08, lng: 8.67 } },
            { code: 'CN', name: 'China', threatLevel: 54, alertCount: 876, blockedCount: 189, topCategory: 'DEVICE_SPOOFING', riskScoreAvg: 58.1, coordinates: { lat: 35.86, lng: 104.19 } },
            { code: 'BR', name: 'Brazil', threatLevel: 45, alertCount: 543, blockedCount: 98, topCategory: 'VELOCITY', riskScoreAvg: 48.7, coordinates: { lat: -14.23, lng: -51.92 } },
            { code: 'IN', name: 'India', threatLevel: 38, alertCount: 432, blockedCount: 67, topCategory: 'LOCATION_ANOMALY', riskScoreAvg: 42.3, coordinates: { lat: 20.59, lng: 78.96 } },
            { code: 'GB', name: 'United Kingdom', threatLevel: 22, alertCount: 234, blockedCount: 23, topCategory: 'MULTIPLE_FAILURES', riskScoreAvg: 31.5, coordinates: { lat: 55.37, lng: -3.43 } },
            { code: 'US', name: 'United States', threatLevel: 18, alertCount: 187, blockedCount: 15, topCategory: 'HIGH_VALUE_TXN', riskScoreAvg: 25.8, coordinates: { lat: 37.09, lng: -95.71 } },
            { code: 'DE', name: 'Germany', threatLevel: 15, alertCount: 145, blockedCount: 12, topCategory: 'VELOCITY', riskScoreAvg: 22.1, coordinates: { lat: 51.16, lng: 10.45 } },
            { code: 'KR', name: 'South Korea', threatLevel: 12, alertCount: 98, blockedCount: 8, topCategory: 'DEVICE_SPOOFING', riskScoreAvg: 18.9, coordinates: { lat: 35.90, lng: 127.76 } },
            { code: 'JP', name: 'Japan', threatLevel: 8, alertCount: 67, blockedCount: 4, topCategory: 'LOCATION_ANOMALY', riskScoreAvg: 14.2, coordinates: { lat: 36.20, lng: 138.25 } },
            { code: 'AU', name: 'Australia', threatLevel: 10, alertCount: 78, blockedCount: 6, topCategory: 'MULTIPLE_FAILURES', riskScoreAvg: 16.5, coordinates: { lat: -25.27, lng: 133.77 } },
            { code: 'MX', name: 'Mexico', threatLevel: 32, alertCount: 312, blockedCount: 45, topCategory: 'VELOCITY', riskScoreAvg: 38.4, coordinates: { lat: 23.63, lng: -102.55 } },
        ];

        return {
            countries: countryData,
            globalThreatIndex: 47.3,
            totalBlockedCountries: 12,
            topThreatOrigin: 'Russia',
            crossBorderAlerts: 3847,
            vpnProxyPercentage: 34.2,
        };
    }

    // ─── Customer Profiles ───────────────────────────────────────────────

    public async getCustomerProfiles(
        search: string,
        tierFilter: CustomerTier | 'ALL',
        sortField: 'overallRiskScore' | 'alertCount' | 'totalTransactionVolume' | 'lastActivity',
        sortDir: SortDirection,
        page: number,
        pageSize: number
    ): Promise<{ profiles: CustomerRiskProfile[]; total: number; pages: number }> {
        await new Promise(r => setTimeout(r, 400));

        let filtered = [...this.customersDataset];

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q)
            );
        }
        if (tierFilter !== 'ALL') filtered = filtered.filter(p => p.tier === tierFilter);

        filtered.sort((a, b) => {
            let aVal: number, bVal: number;
            if (sortField === 'overallRiskScore') { aVal = a.overallRiskScore; bVal = b.overallRiskScore; }
            else if (sortField === 'alertCount') { aVal = a.alertCount; bVal = b.alertCount; }
            else if (sortField === 'totalTransactionVolume') { aVal = a.totalTransactionVolume; bVal = b.totalTransactionVolume; }
            else { aVal = new Date(a.lastActivity).getTime(); bVal = new Date(b.lastActivity).getTime(); }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        const total = filtered.length;
        const pages = Math.ceil(total / pageSize);
        return { profiles: filtered.slice((page - 1) * pageSize, page * pageSize), total, pages };
    }

    public async getCustomerProfile(customerId: string): Promise<CustomerRiskProfile | undefined> {
        await new Promise(r => setTimeout(r, 300));
        return this.customersDataset.find(c => c.id === customerId);
    }

    // ─── Audit Trail ─────────────────────────────────────────────────────

    public async getAuditTrail(
        search: string,
        actionFilter: AuditAction | 'ALL',
        targetTypeFilter: string,
        page: number,
        pageSize: number
    ): Promise<{ entries: AuditLogEntry[]; total: number; pages: number }> {
        await new Promise(r => setTimeout(r, 400));

        let filtered = [...this.auditDataset];

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(e =>
                e.actor.toLowerCase().includes(q) ||
                e.targetId.toLowerCase().includes(q) ||
                e.targetDescription.toLowerCase().includes(q) ||
                e.details.toLowerCase().includes(q)
            );
        }
        if (actionFilter !== 'ALL') filtered = filtered.filter(e => e.action === actionFilter);
        if (targetTypeFilter !== 'ALL') filtered = filtered.filter(e => e.targetType === targetTypeFilter);

        const total = filtered.length;
        const pages = Math.ceil(total / pageSize);
        return { entries: filtered.slice((page - 1) * pageSize, page * pageSize), total, pages };
    }

    // ─── Risk Distribution ───────────────────────────────────────────────

    public async getRiskDistribution(): Promise<RiskDistribution> {
        await new Promise(r => setTimeout(r, 350));

        const buckets: RiskScoreBucket[] = [
            { range: '0-10', min: 0, max: 10, count: 0, percentage: 0, color: '#3B82F6' },
            { range: '11-20', min: 11, max: 20, count: 0, percentage: 0, color: '#3B82F6' },
            { range: '21-30', min: 21, max: 30, count: 0, percentage: 0, color: '#10B981' },
            { range: '31-40', min: 31, max: 40, count: 0, percentage: 0, color: '#10B981' },
            { range: '41-50', min: 41, max: 50, count: 0, percentage: 0, color: '#F59E0B' },
            { range: '51-60', min: 51, max: 60, count: 0, percentage: 0, color: '#F59E0B' },
            { range: '61-70', min: 61, max: 70, count: 0, percentage: 0, color: '#F97316' },
            { range: '71-80', min: 71, max: 80, count: 0, percentage: 0, color: '#F97316' },
            { range: '81-90', min: 81, max: 90, count: 0, percentage: 0, color: '#EF4444' },
            { range: '91-100', min: 91, max: 100, count: 0, percentage: 0, color: '#EF4444' },
        ];

        this.transactionsDataset.forEach(t => {
            const bucket = buckets.find(b => t.riskScore >= b.min && t.riskScore <= b.max);
            if (bucket) bucket.count++;
        });

        const total = this.transactionsDataset.length;
        buckets.forEach(b => {
            b.percentage = total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0;
        });

        const scores = this.transactionsDataset.map(t => t.riskScore).sort((a, b) => a - b);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const medianScore = scores[Math.floor(scores.length / 2)];
        const p95Score = scores[Math.floor(scores.length * 0.95)];

        const trendData: TrendDataPoint[] = [];
        for (let d = 30; d >= 0; d--) {
            const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            trendData.push({
                date,
                avgScore: 30 + Math.random() * 20,
                alertCount: Math.floor(50 + Math.random() * 100),
                blockedCount: Math.floor(5 + Math.random() * 30),
            });
        }

        return {
            buckets,
            totalTransactions: total,
            avgScore: Math.round(avgScore * 10) / 10,
            medianScore: Math.round(medianScore * 10) / 10,
            p95Score: Math.round(p95Score * 10) / 10,
            trendData,
        };
    }

    // ─── Settings ────────────────────────────────────────────────────────

    public async getSettings(): Promise<FraudSettings> {
        await new Promise(r => setTimeout(r, 200));
        return {
            globalThreshold: 65,
            autoBlockThreshold: 90,
            challengeThreshold: 75,
            velocityWindowMinutes: 60,
            maxVelocityPerWindow: 10,
            geoRestrictionEnabled: true,
            restrictedCountries: ['KP', 'IR', 'SY'],
            vpnBlockingEnabled: false,
            emulatorDetectionEnabled: true,
            emailVerificationRequired: true,
            threeDSecureEnabled: true,
            riskScoreAlgorithm: 'ML_ENSEMBLE',
            modelVersion: 'v3.2.1',
            lastModelRetrainedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            notificationWebhook: 'https://hooks.paysphere.io/fraud-alerts',
            notificationEmails: ['fraud@paysphere.io', 'security@paysphere.io'],
            escalationAutoAssign: true,
            maxInvestigationHours: 48,
        };
    }

    public async updateSettings(partial: Partial<FraudSettings>): Promise<FraudSettings> {
        await new Promise(r => setTimeout(r, 500));
        const current = await this.getSettings();
        return { ...current, ...partial };
    }
}

export const FraudRiskService = new FraudRiskServiceAPI();
