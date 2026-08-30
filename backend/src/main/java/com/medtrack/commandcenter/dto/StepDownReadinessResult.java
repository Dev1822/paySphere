package com.medtrack.commandcenter.dto;

import java.util.List;

/**
 * Result of Step-Down / Floor Transfer Readiness evaluation.
 */
public class StepDownReadinessResult {

    private int readinessScore;
    private boolean isReadyForDeescalation;
    private List<String> activeClinicalBarriers;
    private String recommendation;

    public StepDownReadinessResult() {}

    public StepDownReadinessResult(int readinessScore, boolean isReadyForDeescalation,
                                   List<String> activeClinicalBarriers, String recommendation) {
        this.readinessScore = readinessScore;
        this.isReadyForDeescalation = isReadyForDeescalation;
        this.activeClinicalBarriers = activeClinicalBarriers;
        this.recommendation = recommendation;
    }

    public int getReadinessScore() { return readinessScore; }
    public void setReadinessScore(int readinessScore) { this.readinessScore = readinessScore; }

    public boolean isReadyForDeescalation() { return isReadyForDeescalation; }
    public void setReadyForDeescalation(boolean readyForDeescalation) { isReadyForDeescalation = readyForDeescalation; }

    public List<String> getActiveClinicalBarriers() { return activeClinicalBarriers; }
    public void setActiveClinicalBarriers(List<String> activeClinicalBarriers) { this.activeClinicalBarriers = activeClinicalBarriers; }

    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
}
