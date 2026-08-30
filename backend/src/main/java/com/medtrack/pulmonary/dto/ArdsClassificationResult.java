package com.medtrack.pulmonary.dto;

import com.medtrack.pulmonary.model.ArdsSeverity;
import java.util.List;

/**
 * Result of Berlin ARDS clinical definition assessment.
 */
public class ArdsClassificationResult {

    private double pao2Fio2Ratio;
    private double peep;
    private boolean meetsPeepCriteria;
    private ArdsSeverity severity;
    private String classificationLabel;
    private double estimatedMortalityRiskPct;
    private List<String> recommendedEscalations;

    public ArdsClassificationResult() {}

    public ArdsClassificationResult(double pao2Fio2Ratio, double peep, boolean meetsPeepCriteria,
                                    ArdsSeverity severity, double estimatedMortalityRiskPct,
                                    List<String> recommendedEscalations) {
        this.pao2Fio2Ratio = pao2Fio2Ratio;
        this.peep = peep;
        this.meetsPeepCriteria = meetsPeepCriteria;
        this.severity = severity;
        this.classificationLabel = severity.getDescription();
        this.estimatedMortalityRiskPct = estimatedMortalityRiskPct;
        this.recommendedEscalations = recommendedEscalations;
    }

    public double getPao2Fio2Ratio() { return pao2Fio2Ratio; }
    public void setPao2Fio2Ratio(double pao2Fio2Ratio) { this.pao2Fio2Ratio = pao2Fio2Ratio; }

    public double getPeep() { return peep; }
    public void setPeep(double peep) { this.peep = peep; }

    public boolean isMeetsPeepCriteria() { return meetsPeepCriteria; }
    public void setMeetsPeepCriteria(boolean meetsPeepCriteria) { this.meetsPeepCriteria = meetsPeepCriteria; }

    public ArdsSeverity getSeverity() { return severity; }
    public void setSeverity(ArdsSeverity severity) { this.severity = severity; }

    public String getClassificationLabel() { return classificationLabel; }
    public void setClassificationLabel(String classificationLabel) { this.classificationLabel = classificationLabel; }

    public double getEstimatedMortalityRiskPct() { return estimatedMortalityRiskPct; }
    public void setEstimatedMortalityRiskPct(double estimatedMortalityRiskPct) { this.estimatedMortalityRiskPct = estimatedMortalityRiskPct; }

    public List<String> getRecommendedEscalations() { return recommendedEscalations; }
    public void setRecommendedEscalations(List<String> recommendedEscalations) { this.recommendedEscalations = recommendedEscalations; }
}
