package com.medtrack.nicu.dto;

import java.util.List;

public class HypothermiaProtocolStatus {
    private boolean active;
    private String phase;
    private double elapsedHours;
    private double targetCoreTemp;
    private double actualCoreTemp;
    private double rewarmingRatePerHour;
    private String aEEGBackground;
    private boolean withinTherapeuticTarget;
    private List<String> clinicalSafetyAlerts;

    public HypothermiaProtocolStatus() {}

    public HypothermiaProtocolStatus(boolean active, String phase, double elapsedHours, double targetCoreTemp,
                                    double actualCoreTemp, double rewarmingRatePerHour, String aEEGBackground,
                                    boolean withinTherapeuticTarget, List<String> clinicalSafetyAlerts) {
        this.active = active;
        this.phase = phase;
        this.elapsedHours = elapsedHours;
        this.targetCoreTemp = targetCoreTemp;
        this.actualCoreTemp = actualCoreTemp;
        this.rewarmingRatePerHour = rewarmingRatePerHour;
        this.aEEGBackground = aEEGBackground;
        this.withinTherapeuticTarget = withinTherapeuticTarget;
        this.clinicalSafetyAlerts = clinicalSafetyAlerts;
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    public double getElapsedHours() { return elapsedHours; }
    public void setElapsedHours(double elapsedHours) { this.elapsedHours = elapsedHours; }

    public double getTargetCoreTemp() { return targetCoreTemp; }
    public void setTargetCoreTemp(double targetCoreTemp) { this.targetCoreTemp = targetCoreTemp; }

    public double getActualCoreTemp() { return actualCoreTemp; }
    public void setActualCoreTemp(double actualCoreTemp) { this.actualCoreTemp = actualCoreTemp; }

    public double getRewarmingRatePerHour() { return rewarmingRatePerHour; }
    public void setRewarmingRatePerHour(double rewarmingRatePerHour) { this.rewarmingRatePerHour = rewarmingRatePerHour; }

    public String getAEEGBackground() { return aEEGBackground; }
    public void setAEEGBackground(String aEEGBackground) { this.aEEGBackground = aEEGBackground; }

    public boolean isWithinTherapeuticTarget() { return withinTherapeuticTarget; }
    public void setWithinTherapeuticTarget(boolean withinTherapeuticTarget) { this.withinTherapeuticTarget = withinTherapeuticTarget; }

    public List<String> getClinicalSafetyAlerts() { return clinicalSafetyAlerts; }
    public void setClinicalSafetyAlerts(List<String> clinicalSafetyAlerts) { this.clinicalSafetyAlerts = clinicalSafetyAlerts; }
}
