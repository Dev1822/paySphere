package com.medtrack.nephrology.dto;

import com.medtrack.nephrology.model.CrrtTelemetryReading;

public class CrrtAssessmentRequest {
    private String patientId;
    private double patientWeightKg;
    private double baselineCreatinine;
    private double currentCreatinine;
    private double urineOutputMlKgHr;
    private double serumPotassium;
    private double arterialPh;
    private double serumBicarbonate;
    private String crrtModality; // CVVH, CVVHD, CVVHDF, SCUF
    private CrrtTelemetryReading circuitTelemetry;

    public CrrtAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public double getPatientWeightKg() { return patientWeightKg; }
    public void setPatientWeightKg(double patientWeightKg) { this.patientWeightKg = patientWeightKg; }

    public double getBaselineCreatinine() { return baselineCreatinine; }
    public void setBaselineCreatinine(double baselineCreatinine) { this.baselineCreatinine = baselineCreatinine; }

    public double getCurrentCreatinine() { return currentCreatinine; }
    public void setCurrentCreatinine(double currentCreatinine) { this.currentCreatinine = currentCreatinine; }

    public double getUrineOutputMlKgHr() { return urineOutputMlKgHr; }
    public void setUrineOutputMlKgHr(double urineOutputMlKgHr) { this.urineOutputMlKgHr = urineOutputMlKgHr; }

    public double getSerumPotassium() { return serumPotassium; }
    public void setSerumPotassium(double serumPotassium) { this.serumPotassium = serumPotassium; }

    public double getArterialPh() { return arterialPh; }
    public void setArterialPh(double arterialPh) { this.arterialPh = arterialPh; }

    public double getSerumBicarbonate() { return serumBicarbonate; }
    public void setSerumBicarbonate(double serumBicarbonate) { this.serumBicarbonate = serumBicarbonate; }

    public String getCrrtModality() { return crrtModality; }
    public void setCrrtModality(String crrtModality) { this.crrtModality = crrtModality; }

    public CrrtTelemetryReading getCircuitTelemetry() { return circuitTelemetry; }
    public void setCircuitTelemetry(CrrtTelemetryReading circuitTelemetry) { this.circuitTelemetry = circuitTelemetry; }
}
