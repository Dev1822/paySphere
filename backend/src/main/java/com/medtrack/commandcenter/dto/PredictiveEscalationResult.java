package com.medtrack.commandcenter.dto;

import java.util.List;

/**
 * Result of Bio-AI multi-parameter early deterioration and ICU risk prediction.
 */
public class PredictiveEscalationResult {

    private double earlyDeteriorationIndex;
    private String trajectoryClassification;
    private double icuEscalationRisk12hPct;
    private double icuEscalationRisk24hPct;
    private double shockIndex;
    private double modifiedShockIndex;
    private boolean isShockIndexCritical;
    private boolean isRrtActivationIndicated;
    private List<String> topRiskContributingFactors;

    public PredictiveEscalationResult() {}

    public PredictiveEscalationResult(double earlyDeteriorationIndex, String trajectoryClassification,
                                      double icuEscalationRisk12hPct, double icuEscalationRisk24hPct,
                                      double shockIndex, double modifiedShockIndex,
                                      boolean isShockIndexCritical, boolean isRrtActivationIndicated,
                                      List<String> topRiskContributingFactors) {
        this.earlyDeteriorationIndex = earlyDeteriorationIndex;
        this.trajectoryClassification = trajectoryClassification;
        this.icuEscalationRisk12hPct = icuEscalationRisk12hPct;
        this.icuEscalationRisk24hPct = icuEscalationRisk24hPct;
        this.shockIndex = shockIndex;
        this.modifiedShockIndex = modifiedShockIndex;
        this.isShockIndexCritical = isShockIndexCritical;
        this.isRrtActivationIndicated = isRrtActivationIndicated;
        this.topRiskContributingFactors = topRiskContributingFactors;
    }

    public double getEarlyDeteriorationIndex() { return earlyDeteriorationIndex; }
    public void setEarlyDeteriorationIndex(double earlyDeteriorationIndex) { this.earlyDeteriorationIndex = earlyDeteriorationIndex; }

    public String getTrajectoryClassification() { return trajectoryClassification; }
    public void setTrajectoryClassification(String trajectoryClassification) { this.trajectoryClassification = trajectoryClassification; }

    public double getIcuEscalationRisk12hPct() { return icuEscalationRisk12hPct; }
    public void setIcuEscalationRisk12hPct(double icuEscalationRisk12hPct) { this.icuEscalationRisk12hPct = icuEscalationRisk12hPct; }

    public double getIcuEscalationRisk24hPct() { return icuEscalationRisk24hPct; }
    public void setIcuEscalationRisk24hPct(double icuEscalationRisk24hPct) { this.icuEscalationRisk24hPct = icuEscalationRisk24hPct; }

    public double getShockIndex() { return shockIndex; }
    public void setShockIndex(double shockIndex) { this.shockIndex = shockIndex; }

    public double getModifiedShockIndex() { return modifiedShockIndex; }
    public void setModifiedShockIndex(double modifiedShockIndex) { this.modifiedShockIndex = modifiedShockIndex; }

    public boolean isShockIndexCritical() { return isShockIndexCritical; }
    public void setShockIndexCritical(boolean shockIndexCritical) { isShockIndexCritical = shockIndexCritical; }

    public boolean isRrtActivationIndicated() { return isRrtActivationIndicated; }
    public void setRrtActivationIndicated(boolean rrtActivationIndicated) { isRrtActivationIndicated = rrtActivationIndicated; }

    public List<String> getTopRiskContributingFactors() { return topRiskContributingFactors; }
    public void setTopRiskContributingFactors(List<String> topRiskContributingFactors) { this.topRiskContributingFactors = topRiskContributingFactors; }
}
