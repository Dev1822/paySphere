package com.medtrack.neurocritical.dto;

import java.time.Instant;
import java.util.List;

public class NeuromonitoringAssessmentResponse {
    private String patientId;
    private Instant evaluatedAt;
    private double calculatedCpp;
    private String cppInterpretation;
    private String icpSeverityTier;
    private String autoregulationState; // INTACT, BORDERLINE, IMPAIRED
    private double optimalCppTarget;
    private String brainOxygenationStatus; // NORMIC, CAUTION, SEVERE_HYPOXIA
    private String pupillometryAlertStatus;
    private SibiccEscalationStatus sibiccStatus;
    private String hyperosmolarDosingRecommendation;
    private List<String> activeNeurologicalAlarms;
    private List<String> prioritizedClinicalActions;

    public NeuromonitoringAssessmentResponse() {
        this.evaluatedAt = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public Instant getEvaluatedAt() { return evaluatedAt; }
    public void setEvaluatedAt(Instant evaluatedAt) { this.evaluatedAt = evaluatedAt; }

    public double getCalculatedCpp() { return calculatedCpp; }
    public void setCalculatedCpp(double calculatedCpp) { this.calculatedCpp = calculatedCpp; }

    public String getCppInterpretation() { return cppInterpretation; }
    public void setCppInterpretation(String cppInterpretation) { this.cppInterpretation = cppInterpretation; }

    public String getIcpSeverityTier() { return icpSeverityTier; }
    public void setIcpSeverityTier(String icpSeverityTier) { this.icpSeverityTier = icpSeverityTier; }

    public String getAutoregulationState() { return autoregulationState; }
    public void setAutoregulationState(String autoregulationState) { this.autoregulationState = autoregulationState; }

    public double getOptimalCppTarget() { return optimalCppTarget; }
    public void setOptimalCppTarget(double optimalCppTarget) { this.optimalCppTarget = optimalCppTarget; }

    public String getBrainOxygenationStatus() { return brainOxygenationStatus; }
    public void setBrainOxygenationStatus(String brainOxygenationStatus) { this.brainOxygenationStatus = brainOxygenationStatus; }

    public String getPupillometryAlertStatus() { return pupillometryAlertStatus; }
    public void setPupillometryAlertStatus(String pupillometryAlertStatus) { this.pupillometryAlertStatus = pupillometryAlertStatus; }

    public SibiccEscalationStatus getSibiccStatus() { return sibiccStatus; }
    public void setSibiccStatus(SibiccEscalationStatus sibiccStatus) { this.sibiccStatus = sibiccStatus; }

    public String getHyperosmolarDosingRecommendation() { return hyperosmolarDosingRecommendation; }
    public void setHyperosmolarDosingRecommendation(String hyperosmolarDosingRecommendation) { this.hyperosmolarDosingRecommendation = hyperosmolarDosingRecommendation; }

    public List<String> getActiveNeurologicalAlarms() { return activeNeurologicalAlarms; }
    public void setActiveNeurologicalAlarms(List<String> activeNeurologicalAlarms) { this.activeNeurologicalAlarms = activeNeurologicalAlarms; }

    public List<String> getPrioritizedClinicalActions() { return prioritizedClinicalActions; }
    public void setPrioritizedClinicalActions(List<String> prioritizedClinicalActions) { this.prioritizedClinicalActions = prioritizedClinicalActions; }
}
