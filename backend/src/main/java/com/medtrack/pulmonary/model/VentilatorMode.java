package com.medtrack.pulmonary.model;

/**
 * Advanced Mechanical Ventilation Modes.
 */
public enum VentilatorMode {
    VC_CMV("Volume Control Continuous Mandatory Ventilation", "VOLUME_TARGETED"),
    PC_CMV("Pressure Control Continuous Mandatory Ventilation", "PRESSURE_TARGETED"),
    PRVC("Pressure-Regulated Volume Control", "DUAL_CONTROL"),
    PSV_CPAP("Pressure Support Ventilation / CPAP", "SPONTANEOUS"),
    APRV("Airway Pressure Release Ventilation", "OPEN_LUNG");

    private final String displayName;
    private final String category;

    VentilatorMode(String displayName, String category) {
        this.displayName = displayName;
        this.category = category;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCategory() {
        return category;
    }
}
