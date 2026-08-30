package com.medtrack.commandcenter.dto;

import java.util.Map;

/**
 * Result of National Early Warning Score 2 (NEWS2) calculation.
 */
public class EarlyWarningScoreResult {

    private int totalScore;
    private String riskTier;
    private String monitoringFrequency;
    private String suggestedClinicalAction;
    private Map<String, Integer> componentBreakdown;

    public EarlyWarningScoreResult() {}

    public EarlyWarningScoreResult(int totalScore, String riskTier, String monitoringFrequency,
                                   String suggestedClinicalAction, Map<String, Integer> componentBreakdown) {
        this.totalScore = totalScore;
        this.riskTier = riskTier;
        this.monitoringFrequency = monitoringFrequency;
        this.suggestedClinicalAction = suggestedClinicalAction;
        this.componentBreakdown = componentBreakdown;
    }

    public int getTotalScore() { return totalScore; }
    public void setTotalScore(int totalScore) { this.totalScore = totalScore; }

    public String getRiskTier() { return riskTier; }
    public void setRiskTier(String riskTier) { this.riskTier = riskTier; }

    public String getMonitoringFrequency() { return monitoringFrequency; }
    public void setMonitoringFrequency(String monitoringFrequency) { this.monitoringFrequency = monitoringFrequency; }

    public String getSuggestedClinicalAction() { return suggestedClinicalAction; }
    public void setSuggestedClinicalAction(String suggestedClinicalAction) { this.suggestedClinicalAction = suggestedClinicalAction; }

    public Map<String, Integer> getComponentBreakdown() { return componentBreakdown; }
    public void setComponentBreakdown(Map<String, Integer> componentBreakdown) { this.componentBreakdown = componentBreakdown; }
}
