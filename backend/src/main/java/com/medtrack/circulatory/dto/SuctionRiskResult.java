package com.medtrack.circulatory.dto;

import java.util.List;

/**
 * Result of Impella/LVAD suction event and hemolysis surveillance.
 */
public class SuctionRiskResult {

    private boolean isSuctionDetected;
    private double motorCurrentMilliamps;
    private double plasmaFreeHbMgDl;
    private String hemolysisRiskTier;
    private List<String> actionableRecommendations;

    public SuctionRiskResult() {}

    public SuctionRiskResult(boolean isSuctionDetected, double motorCurrentMilliamps,
                             double plasmaFreeHbMgDl, String hemolysisRiskTier,
                             List<String> actionableRecommendations) {
        this.isSuctionDetected = isSuctionDetected;
        this.motorCurrentMilliamps = motorCurrentMilliamps;
        this.plasmaFreeHbMgDl = plasmaFreeHbMgDl;
        this.hemolysisRiskTier = hemolysisRiskTier;
        this.actionableRecommendations = actionableRecommendations;
    }

    public boolean isSuctionDetected() { return isSuctionDetected; }
    public void setSuctionDetected(boolean suctionDetected) { isSuctionDetected = suctionDetected; }

    public double getMotorCurrentMilliamps() { return motorCurrentMilliamps; }
    public void setMotorCurrentMilliamps(double motorCurrentMilliamps) { this.motorCurrentMilliamps = motorCurrentMilliamps; }

    public double getPlasmaFreeHbMgDl() { return plasmaFreeHbMgDl; }
    public void setPlasmaFreeHbMgDl(double plasmaFreeHbMgDl) { this.plasmaFreeHbMgDl = plasmaFreeHbMgDl; }

    public String getHemolysisRiskTier() { return hemolysisRiskTier; }
    public void setHemolysisRiskTier(String hemolysisRiskTier) { this.hemolysisRiskTier = hemolysisRiskTier; }

    public List<String> getActionableRecommendations() { return actionableRecommendations; }
    public void setActionableRecommendations(List<String> actionableRecommendations) { this.actionableRecommendations = actionableRecommendations; }
}
