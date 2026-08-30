"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseAnalyticsModel = void 0;
class EnterpriseAnalyticsModel {
    modelId;
    modelTitle;
    scenarioType;
    projectedSpendUSD;
    variancePercent;
    headcountDelta;
    confidenceScore;
    iterations;
    isApprovedByCFO;
    createdAt;
    constructor(data) {
        this.modelId = data.modelId || `fc_${Math.random().toString(36).substr(2, 9)}`;
        this.modelTitle = data.modelTitle || 'Quarterly Forecast Model';
        this.scenarioType = data.scenarioType || 'Growth';
        this.projectedSpendUSD = data.projectedSpendUSD || 5000000;
        this.variancePercent = data.variancePercent || 1.5;
        this.headcountDelta = data.headcountDelta || 10;
        this.confidenceScore = data.confidenceScore || 95.0;
        this.iterations = data.iterations || [];
        this.isApprovedByCFO = data.isApprovedByCFO ?? true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }
    toJSON() {
        return {
            modelId: this.modelId,
            modelTitle: this.modelTitle,
            scenarioType: this.scenarioType,
            projectedSpendUSD: this.projectedSpendUSD,
            variancePercent: this.variancePercent,
            headcountDelta: this.headcountDelta,
            confidenceScore: this.confidenceScore,
            iterations: this.iterations,
            isApprovedByCFO: this.isApprovedByCFO,
            createdAt: this.createdAt,
        };
    }
}
exports.EnterpriseAnalyticsModel = EnterpriseAnalyticsModel;
//# sourceMappingURL=EnterpriseAnalyticsModel.js.map