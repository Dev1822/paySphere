package com.medtrack.nephrology.dto;

import java.util.List;

public class CitrateAnticoagulationStatus {
    private boolean rcaActive;
    private double postFilterICa;
    private double systemicICa;
    private double totalCalciumToIonizedCalciumRatio;
    private boolean citrateAccumulationWarning;
    private String circuitAnticoagulationAdequacy;
    private List<String> safetyAlerts;

    public CitrateAnticoagulationStatus() {}

    public CitrateAnticoagulationStatus(boolean rcaActive, double postFilterICa, double systemicICa,
                                      double totalCalciumToIonizedCalciumRatio, boolean citrateAccumulationWarning,
                                      String circuitAnticoagulationAdequacy, List<String> safetyAlerts) {
        this.rcaActive = rcaActive;
        this.postFilterICa = postFilterICa;
        this.systemicICa = systemicICa;
        this.totalCalciumToIonizedCalciumRatio = totalCalciumToIonizedCalciumRatio;
        this.citrateAccumulationWarning = citrateAccumulationWarning;
        this.circuitAnticoagulationAdequacy = circuitAnticoagulationAdequacy;
        this.safetyAlerts = safetyAlerts;
    }

    public boolean isRcaActive() { return rcaActive; }
    public void setRcaActive(boolean rcaActive) { this.rcaActive = rcaActive; }

    public double getPostFilterICa() { return postFilterICa; }
    public void setPostFilterICa(double postFilterICa) { this.postFilterICa = postFilterICa; }

    public double getSystemicICa() { return systemicICa; }
    public void setSystemicICa(double systemicICa) { this.systemicICa = systemicICa; }

    public double getTotalCalciumToIonizedCalciumRatio() { return totalCalciumToIonizedCalciumRatio; }
    public void setTotalCalciumToIonizedCalciumRatio(double totalCalciumToIonizedCalciumRatio) { this.totalCalciumToIonizedCalciumRatio = totalCalciumToIonizedCalciumRatio; }

    public boolean isCitrateAccumulationWarning() { return citrateAccumulationWarning; }
    public void setCitrateAccumulationWarning(boolean citrateAccumulationWarning) { this.citrateAccumulationWarning = citrateAccumulationWarning; }

    public String getCircuitAnticoagulationAdequacy() { return circuitAnticoagulationAdequacy; }
    public void setCircuitAnticoagulationAdequacy(String circuitAnticoagulationAdequacy) { this.circuitAnticoagulationAdequacy = circuitAnticoagulationAdequacy; }

    public List<String> getSafetyAlerts() { return safetyAlerts; }
    public void setSafetyAlerts(List<String> safetyAlerts) { this.safetyAlerts = safetyAlerts; }
}
