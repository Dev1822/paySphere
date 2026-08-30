package com.medtrack.neurocritical.dto;

import com.medtrack.neurocritical.model.NeuromonitoringTelemetryReading;

public class NeuromonitoringAssessmentRequest {
    private String patientId;
    private double patientWeightKg;
    private String admissionDiagnosis;
    private int glasgowComaScale;
    private NeuromonitoringTelemetryReading telemetryReading;

    public NeuromonitoringAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public double getPatientWeightKg() { return patientWeightKg; }
    public void setPatientWeightKg(double patientWeightKg) { this.patientWeightKg = patientWeightKg; }

    public String getAdmissionDiagnosis() { return admissionDiagnosis; }
    public void setAdmissionDiagnosis(String admissionDiagnosis) { this.admissionDiagnosis = admissionDiagnosis; }

    public int getGlasgowComaScale() { return glasgowComaScale; }
    public void setGlasgowComaScale(int glasgowComaScale) { this.glasgowComaScale = glasgowComaScale; }

    public NeuromonitoringTelemetryReading getTelemetryReading() { return telemetryReading; }
    public void setTelemetryReading(NeuromonitoringTelemetryReading telemetryReading) { this.telemetryReading = telemetryReading; }
}
