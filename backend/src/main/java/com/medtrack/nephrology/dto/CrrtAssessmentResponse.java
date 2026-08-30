package com.medtrack.nephrology.dto;

import java.time.Instant;
import java.util.List;

public class CrrtAssessmentResponse {
    private String patientId;
    private Instant evaluatedAt;
    private int kdigoStage;
    private String kdigoInterpretation;
    private double effluentDoseMlKgHr;
    private String effluentDoseTargetStatus;
    private double transmembranePressure;
    private double filterPressureDrop;
    private String circuitClottingRisk;
    private CitrateAnticoagulationStatus citrateStatus;
    private List<String> activeClinicalAlerts;
    private List<String> recommendedAdjustments;

    public CrrtAssessmentResponse() {
        this.evaluatedAt = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public Instant getEvaluatedAt() { return evaluatedAt; }
    public void setEvaluatedAt(Instant evaluatedAt) { this.evaluatedAt = evaluatedAt; }

    public int getKdigoStage() { return kdigoStage; }
    public void setKdigoStage(int kdigoStage) { this.kdigoStage = kdigoStage; }

    public String getKdigoInterpretation() { return kdigoInterpretation; }
    public void setKdigoInterpretation(String kdigoInterpretation) { this.kdigoInterpretation = kdigoInterpretation; }

    public double getEffluentDoseMlKgHr() { return effluentDoseMlKgHr; }
    public void setEffluentDoseMlKgHr(double effluentDoseMlKgHr) { this.effluentDoseMlKgHr = effluentDoseMlKgHr; }

    public String getEffluentDoseTargetStatus() { return effluentDoseTargetStatus; }
    public void setEffluentDoseTargetStatus(String effluentDoseTargetStatus) { this.effluentDoseTargetStatus = effluentDoseTargetStatus; }

    public double getTransmembranePressure() { return transmembranePressure; }
    public void setTransmembranePressure(double transmembranePressure) { this.transmembranePressure = transmembranePressure; }

    public double getFilterPressureDrop() { return filterPressureDrop; }
    public void setFilterPressureDrop(double filterPressureDrop) { this.filterPressureDrop = filterPressureDrop; }

    public String getCircuitClottingRisk() { return circuitClottingRisk; }
    public void setCircuitClottingRisk(String circuitClottingRisk) { this.circuitClottingRisk = circuitClottingRisk; }

    public CitrateAnticoagulationStatus getCitrateStatus() { return citrateStatus; }
    public void setCitrateStatus(CitrateAnticoagulationStatus citrateStatus) { this.citrateStatus = citrateStatus; }

    public List<String> getActiveClinicalAlerts() { return activeClinicalAlerts; }
    public void setActiveClinicalAlerts(List<String> activeClinicalAlerts) { this.activeClinicalAlerts = activeClinicalAlerts; }

    public List<String> getRecommendedAdjustments() { return recommendedAdjustments; }
    public void setRecommendedAdjustments(List<String> recommendedAdjustments) { this.recommendedAdjustments = recommendedAdjustments; }
}
