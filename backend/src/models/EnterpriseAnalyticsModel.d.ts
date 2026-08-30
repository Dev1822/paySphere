export interface SimulationIterationDTO {
    iterationId: number;
    simulatedSpendUSD: number;
    taxEscalationDeltaUSD: number;
}
export declare class EnterpriseAnalyticsModel {
    modelId: string;
    modelTitle: string;
    scenarioType: 'Growth' | 'Regulatory' | 'Compensation';
    projectedSpendUSD: number;
    variancePercent: number;
    headcountDelta: number;
    confidenceScore: number;
    iterations: SimulationIterationDTO[];
    isApprovedByCFO: boolean;
    createdAt: string;
    constructor(data: Partial<EnterpriseAnalyticsModel>);
    toJSON(): {
        modelId: string;
        modelTitle: string;
        scenarioType: "Compensation" | "Growth" | "Regulatory";
        projectedSpendUSD: number;
        variancePercent: number;
        headcountDelta: number;
        confidenceScore: number;
        iterations: SimulationIterationDTO[];
        isApprovedByCFO: boolean;
        createdAt: string;
    };
}
//# sourceMappingURL=EnterpriseAnalyticsModel.d.ts.map