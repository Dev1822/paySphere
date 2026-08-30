import {
    PaymentTransaction,
    ComprehensiveAnalyticsPayload,
    AnalyticsFilter,
    PaymentStatus,
    PaymentMethodType,
    Region,
    CurrencyCode,
    TimeSeriesDataPoint,
    MethodPerformanceMetric,
    RegionalPerformanceMetric
} from '../types/paymentAnalytics';

class PaymentAnalyticsEngine {
    private dataset: PaymentTransaction[] = [];

    constructor() {
        this.bootstrapData(3500); // 3500 robust records for rich analytics
    }

    private bootstrapData(count: number) {
        const statuses: PaymentStatus[] = ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'FAILED', 'PENDING', 'REFUNDED', 'DISPUTED'];
        const methods: PaymentMethodType[] = ['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CRYPTO', 'DIGITAL_WALLET', 'BNPL'];
        const currencies: CurrencyCode[] = ['USD', 'EUR', 'GBP'];
        const regions: Region[] = ['NORTH_AMERICA', 'EUROPE', 'ASIA_PACIFIC', 'LATIN_AMERICA'];

        const now = new Date();
        const gateways = ['Stripe', 'Adyen', 'PayPal', 'Coinbase Commerce', 'Checkout.com'];

        for (let i = 0; i < count; i++) {
            const randomDaysAgo = Math.random() * 90; // Last 90 days
            const txnDate = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));

            const method = methods[Math.floor(Math.random() * methods.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            let amount = Math.floor(Math.random() * 5000) + 10;

            // Add anomalies for richness
            if (Math.random() > 0.98) amount = amount * 10;

            let feePercentage = 0;
            switch (method) {
                case 'CREDIT_CARD': feePercentage = 0.029; break;
                case 'BANK_TRANSFER': feePercentage = 0.005; break;
                case 'CRYPTO': feePercentage = 0.01; break;
                case 'DIGITAL_WALLET': feePercentage = 0.025; break;
                case 'BNPL': feePercentage = 0.06; break;
                default: feePercentage = 0.02;
            }

            const feeAmount = parseFloat((amount * feePercentage).toFixed(2));
            const netAmount = parseFloat((amount - feeAmount).toFixed(2));

            this.dataset.push({
                id: `txn_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                timestamp: txnDate.toISOString(),
                amount,
                currency: currencies[Math.floor(Math.random() * currencies.length)],
                status,
                method,
                customerId: `cus_${Math.floor(Math.random() * 10000)}`,
                customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
                region: regions[Math.floor(Math.random() * regions.length)],
                gateway: gateways[Math.floor(Math.random() * gateways.length)],
                feeAmount,
                netAmount,
                metadata: {
                    fraudScore: Math.random(),
                    ipRisk: Math.random() > 0.8 ? 'HIGH' : 'LOW',
                    deviceType: Math.random() > 0.5 ? 'MOBILE' : 'DESKTOP'
                }
            });
        }

        this.dataset.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    public async fetchAnalytics(filter: AnalyticsFilter): Promise<ComprehensiveAnalyticsPayload> {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate complex calculation latency

        let filtered = [...this.dataset];

        if (filter.dateRange) {
            const start = new Date(filter.dateRange.startDate).getTime();
            const end = new Date(filter.dateRange.endDate).getTime();
            filtered = filtered.filter(t => {
                const time = new Date(t.timestamp).getTime();
                return time >= start && time <= end;
            });
        }

        if (filter.regions && filter.regions.length > 0) {
            filtered = filtered.filter(t => filter.regions!.includes(t.region));
        }

        if (filter.methods && filter.methods.length > 0) {
            filtered = filtered.filter(t => filter.methods!.includes(t.method));
        }

        if (filter.statuses && filter.statuses.length > 0) {
            filtered = filtered.filter(t => filter.statuses!.includes(t.status));
        }

        if (filter.minAmount !== undefined) {
            filtered = filtered.filter(t => t.amount >= filter.minAmount!);
        }

        if (filter.maxAmount !== undefined) {
            filtered = filtered.filter(t => t.amount <= filter.maxAmount!);
        }

        // Compute overarching metrics
        const totalGrossRevenue = filtered.reduce((acc, t) => acc + (t.status === 'SUCCESS' ? t.amount : 0), 0);
        const totalFees = filtered.reduce((acc, t) => acc + (t.status === 'SUCCESS' ? t.feeAmount : 0), 0);
        const totalNetRevenue = totalGrossRevenue - totalFees;
        const transactionCount = filtered.length;

        const successfulCount = filtered.filter(t => t.status === 'SUCCESS').length;
        const failedCount = filtered.filter(t => t.status === 'FAILED').length;
        const refundedCount = filtered.filter(t => t.status === 'REFUNDED').length;
        const disputeCount = filtered.filter(t => t.status === 'DISPUTED').length;

        const avgTransactionValue = successfulCount > 0 ? totalGrossRevenue / successfulCount : 0;
        const approvalRate = transactionCount > 0 ? (successfulCount / transactionCount) * 100 : 0;

        // TimeSeries grouping (Daily)
        const tsMap = new Map<string, { g: number, n: number, f: number, v: number, sc: number }>();
        for (const t of filtered) {
            const dayStr = t.timestamp.split('T')[0];
            if (!tsMap.has(dayStr)) tsMap.set(dayStr, { g: 0, n: 0, f: 0, v: 0, sc: 0 });
            const agg = tsMap.get(dayStr)!;
            agg.v += 1;
            if (t.status === 'SUCCESS') {
                agg.g += t.amount;
                agg.n += t.netAmount;
                agg.f += t.feeAmount;
                agg.sc += 1;
            }
        }

        const timeSeries: TimeSeriesDataPoint[] = Array.from(tsMap.entries()).map(([k, v]) => ({
            timeIndex: k,
            grossRevenue: v.g,
            netRevenue: v.n,
            fees: v.f,
            volume: v.v,
            successRate: v.v > 0 ? (v.sc / v.v) * 100 : 0
        })).sort((a, b) => new Date(a.timeIndex).getTime() - new Date(b.timeIndex).getTime());

        // Method Performance
        const methodMap = new Map<PaymentMethodType, any>();
        filtered.forEach(t => {
            if (!methodMap.has(t.method)) methodMap.set(t.method, { method: t.method, volume: 0, revenue: 0, fees: 0, sc: 0, ref: 0 });
            const m = methodMap.get(t.method);
            m.volume += 1;
            if (t.status === 'SUCCESS') m.sc += 1;
            if (t.status === 'REFUNDED') m.ref += 1;
            if (t.status === 'SUCCESS') {
                m.revenue += t.amount;
                m.fees += t.feeAmount;
            }
        });

        const methodPerformance: MethodPerformanceMetric[] = Array.from(methodMap.values()).map(m => ({
            method: m.method,
            volume: m.volume,
            revenue: m.revenue,
            fees: m.fees,
            successRate: m.volume > 0 ? (m.sc / m.volume) * 100 : 0,
            refundRate: m.volume > 0 ? (m.ref / m.volume) * 100 : 0,
            averageValue: m.sc > 0 ? m.revenue / m.sc : 0
        }));

        // Region Performance
        const regMap = new Map<Region, any>();
        filtered.forEach(t => {
            if (!regMap.has(t.region)) regMap.set(t.region, { region: t.region, revenue: 0, volume: 0, topMethodCounts: {} });
            const r = regMap.get(t.region);
            r.volume += 1;
            if (t.status === 'SUCCESS') r.revenue += t.amount;
            r.topMethodCounts[t.method] = (r.topMethodCounts[t.method] || 0) + 1;
        });

        const regionalPerformance: RegionalPerformanceMetric[] = Array.from(regMap.values()).map(r => {
            const topMethod = Object.keys(r.topMethodCounts).reduce((a, b) => r.topMethodCounts[a] > r.topMethodCounts[b] ? a : b) as PaymentMethodType;
            return {
                region: r.region,
                revenue: r.revenue,
                volume: r.volume,
                processingSpeedAvgMs: 250 + Math.random() * 500, // mock latency 
                topMethod
            }
        });

        return {
            metrics: {
                totalGrossRevenue,
                totalNetRevenue,
                totalFees,
                transactionCount,
                successfulCount,
                failedCount,
                refundedCount,
                disputeCount,
                avgTransactionValue,
                approvalRate
            },
            timeSeries,
            methodPerformance,
            regionalPerformance,
            recentTransactions: filtered.slice(0, 50)
        };
    }
}

export const PaymentAnalyticsService = new PaymentAnalyticsEngine();
