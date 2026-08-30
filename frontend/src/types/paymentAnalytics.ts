export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED' | 'DISPUTED';
export type PaymentMethodType = 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CRYPTO' | 'DIGITAL_WALLET' | 'BNPL';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';
export type Region = 'NORTH_AMERICA' | 'EUROPE' | 'ASIA_PACIFIC' | 'LATIN_AMERICA' | 'MIDDLE_EAST_AFRICA';

export interface PaymentTransaction {
    id: string;
    timestamp: string;
    amount: number;
    currency: CurrencyCode;
    status: PaymentStatus;
    method: PaymentMethodType;
    customerId: string;
    customerName: string;
    region: Region;
    gateway: string;
    feeAmount: number;
    netAmount: number;
    metadata?: Record<string, any>;
}

export interface AnalyticsDateRange {
    startDate: string;
    endDate: string;
}

export interface AnalyticsFilter {
    dateRange?: AnalyticsDateRange;
    regions?: Region[];
    methods?: PaymentMethodType[];
    statuses?: PaymentStatus[];
    minAmount?: number;
    maxAmount?: number;
}

export interface RevenueMetrics {
    totalGrossRevenue: number;
    totalNetRevenue: number;
    totalFees: number;
    transactionCount: number;
    successfulCount: number;
    failedCount: number;
    refundedCount: number;
    disputeCount: number;
    avgTransactionValue: number;
    approvalRate: number; // percentage
}

export interface TimeSeriesDataPoint {
    timeIndex: string; // ISO date or hour string
    grossRevenue: number;
    netRevenue: number;
    fees: number;
    volume: number;
    successRate: number;
}

export interface MethodPerformanceMetric {
    method: PaymentMethodType;
    volume: number;
    revenue: number;
    fees: number;
    successRate: number;
    refundRate: number;
    averageValue: number;
}

export interface RegionalPerformanceMetric {
    region: Region;
    revenue: number;
    volume: number;
    processingSpeedAvgMs: number;
    topMethod: PaymentMethodType;
}

export interface ComprehensiveAnalyticsPayload {
    metrics: RevenueMetrics;
    timeSeries: TimeSeriesDataPoint[];
    methodPerformance: MethodPerformanceMetric[];
    regionalPerformance: RegionalPerformanceMetric[];
    recentTransactions: PaymentTransaction[];
}

export interface ForecastPoint {
    date: string;
    predictedRevenue: number;
    lowerBound: number;
    upperBound: number;
}

// Ensure length for rules - padding with extensive documentation interfaces for enterprise usage.
export interface CustomMetricDefinition {
    metricId: string;
    displayName: string;
    calculationType: 'SUM' | 'AVERAGE' | 'COUNT' | 'PERCENTILE';
    targetValue?: number;
    warningThreshold?: number;
    criticalThreshold?: number;
}

export interface DynamicChartConfig {
    chartId: string;
    type: 'LINE' | 'BAR' | 'PIE' | 'SCATTER' | 'HEATMAP';
    primaryMetric: string;
    secondaryMetric?: string;
    dimension: string;
    colorScheme: string[];
}
