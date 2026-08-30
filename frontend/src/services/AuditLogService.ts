import { AuditLog, AuditLogCategory, AuditLogFilterOptions, AuditLogSeverity } from '../types/auditLog';

class AuditLogServiceAPI {
    private mockLogs: AuditLog[] = [];

    constructor() {
        this.generateMockData(500); // 500 records
    }

    private generateMockData(count: number) {
        const categories: AuditLogCategory[] = ['AUTHENTICATION', 'USER_MANAGEMENT', 'PAYMENT_PROCESSING', 'SECURITY_SETTINGS', 'SYSTEM_CONFIG', 'API_ACCESS'];
        const severities: AuditLogSeverity[] = ['INFO', 'WARNING', 'CRITICAL', 'ERROR'];
        const statuses: ('SUCCESS' | 'FAILURE' | 'PENDING')[] = ['SUCCESS', 'FAILURE', 'PENDING'];
        const actionsDescMap: Record<AuditLogCategory, { action: string, desc: string }[]> = {
            AUTHENTICATION: [
                { action: 'user.login', desc: 'User successfully logged in' },
                { action: 'user.logout', desc: 'User safely terminated session' },
                { action: 'user.failed_login', desc: 'Invalid credentials provided during login attempt' }
            ],
            USER_MANAGEMENT: [
                { action: 'user.created', desc: 'New user account provisioned in the system' },
                { action: 'user.deleted', desc: 'User account permanently removed' },
                { action: 'user.role_changed', desc: 'User permissions escalated by administrator' }
            ],
            PAYMENT_PROCESSING: [
                { action: 'payment.processed', desc: 'Payment successfully captured via Stripe gateway' },
                { action: 'payment.refunded', desc: 'Refund issued to customer card' },
                { action: 'payment.failed', desc: 'Payment rejected due to insufficient funds' }
            ],
            SECURITY_SETTINGS: [
                { action: 'security.mfa_enabled', desc: 'Multi-factor authentication enabled' },
                { action: 'security.password_changed', desc: 'Account password updated' },
                { action: 'security.api_key_rotated', desc: 'Production API keys rotated' }
            ],
            SYSTEM_CONFIG: [
                { action: 'config.updated', desc: 'Global system configuration altered' },
                { action: 'config.feature_flag_toggled', desc: 'Beta feature flag activated' }
            ],
            API_ACCESS: [
                { action: 'api.rate_limit_exceeded', desc: 'Client exceeded permitted API rate limits' },
                { action: 'api.unauthorized_access', desc: 'Attempt to access restricted endpoint' }
            ]
        };

        const actors = [
            { id: 'usr_1', name: 'Alice Smith', email: 'alice@domain.com', role: 'admin', avatarUrl: 'https://i.pravatar.cc/150?u=alice' },
            { id: 'usr_2', name: 'Bob Jones', email: 'bob@domain.com', role: 'user', avatarUrl: 'https://i.pravatar.cc/150?u=bob' },
            { id: 'usr_3', name: 'System Context', email: 'system@paysphere.app', role: 'system', avatarUrl: 'https://i.pravatar.cc/150?u=system' },
            { id: 'usr_4', name: 'Eve Hacker', email: 'eve@suspicious.com', role: 'user', avatarUrl: 'https://i.pravatar.cc/150?u=eve' }
        ];

        const resources = [
            { id: 'res_1', type: 'Account', name: 'Primary Wallet' },
            { id: 'res_2', type: 'Transaction', name: 'TXN-99432' },
            { id: 'res_3', type: 'User', name: 'Bob Jones Profile' },
            { id: 'res_4', type: 'System', name: 'Global Rate Limiter' }
        ];

        const locations = [
            { city: 'San Francisco', country: 'US', timezone: 'PST' },
            { city: 'London', country: 'UK', timezone: 'GMT' },
            { city: 'Tokyo', country: 'JP', timezone: 'JST' },
            { city: 'Berlin', country: 'DE', timezone: 'CET' }
        ];

        for (let i = 0; i < count; i++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const actionSet = actionsDescMap[category];
            const actionTemplate = actionSet[Math.floor(Math.random() * actionSet.length)];

            const isError = actionTemplate.action.includes('failed') || actionTemplate.action.includes('exceeded') || actionTemplate.action.includes('unauthorized');
            let severity: AuditLogSeverity = 'INFO';
            let status: 'SUCCESS' | 'FAILURE' | 'PENDING' = 'SUCCESS';

            if (isError) {
                severity = Math.random() > 0.5 ? 'ERROR' : 'WARNING';
                status = 'FAILURE';
            } else {
                if (Math.random() > 0.9) severity = 'CRITICAL';
                if (Math.random() > 0.9) status = 'PENDING';
            }

            const date = new Date();
            date.setSeconds(date.getSeconds() - Math.floor(Math.random() * 2592000)); // Up to 30 days ago

            this.mockLogs.push({
                id: `aud_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                timestamp: date.toISOString(),
                category,
                action: actionTemplate.action,
                description: actionTemplate.desc,
                severity,
                status,
                actor: actors[Math.floor(Math.random() * actors.length)],
                resource: resources[Math.floor(Math.random() * resources.length)],
                metadata: {
                    ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    location: locations[Math.floor(Math.random() * locations.length)],
                    additionalData: Math.random() > 0.7 ? { traceId: `trace_${Math.random().toString(36).substr(2, 9)}` } : undefined
                }
            });
        }

        // Sort descending by timestamp
        this.mockLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    public async getLogs(options: AuditLogFilterOptions, page: number = 1, pageSize: number = 20): Promise<{ data: AuditLog[], total: number }> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));

        let filtered = [...this.mockLogs];

        if (options.searchTerm) {
            const term = options.searchTerm.toLowerCase();
            filtered = filtered.filter(log =>
                log.action.toLowerCase().includes(term) ||
                log.description.toLowerCase().includes(term) ||
                log.actor.name.toLowerCase().includes(term) ||
                log.actor.email.toLowerCase().includes(term) ||
                log.metadata.ipAddress.includes(term)
            );
        }

        if (options.categories && options.categories.length > 0) {
            filtered = filtered.filter(log => options.categories!.includes(log.category));
        }

        if (options.severities && options.severities.length > 0) {
            filtered = filtered.filter(log => options.severities!.includes(log.severity));
        }

        if (options.status && options.status.length > 0) {
            filtered = filtered.filter(log => options.status!.includes(log.status));
        }

        if (options.dateRange) {
            const start = new Date(options.dateRange.start).getTime();
            const end = new Date(options.dateRange.end).getTime();
            filtered = filtered.filter(log => {
                const time = new Date(log.timestamp).getTime();
                return time >= start && time <= end;
            });
        }

        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;

        return {
            data: filtered.slice(startIdx, endIdx),
            total: filtered.length
        };
    }

    public async getLogstats(): Promise<{ total: number, warning: number, critical: number, today: number }> {
        await new Promise(resolve => setTimeout(resolve, 200));

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        const stats = this.mockLogs.reduce((acc, log) => {
            acc.total++;
            if (log.severity === 'WARNING') acc.warning++;
            if (log.severity === 'CRITICAL' || log.severity === 'ERROR') acc.critical++;

            if (now - new Date(log.timestamp).getTime() < oneDay) {
                acc.today++;
            }
            return acc;
        }, { total: 0, warning: 0, critical: 0, today: 0 });

        return stats;
    }
}

export const AuditLogService = new AuditLogServiceAPI();
