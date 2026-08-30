package com.medtrack.commandcenter.model;

/**
 * Hospital Inpatient and Intensive Care Units.
 */
public enum HospitalUnit {
    MICU("Medical Intensive Care Unit", "ICU", 24),
    SICU("Surgical Trauma ICU", "ICU", 20),
    NEURO_ICU("Neurocritical Care Unit", "ICU", 16),
    PCU_STEPDOWN("Progressive Care / Step-Down Unit", "STEP_DOWN", 32),
    CARDIAC_TELEMETRY("Cardiac Telemetry Ward (4 East)", "TELEMETRY", 36),
    MED_SURG_NORTH("General Med-Surg Ward (5 North)", "MED_SURG", 48),
    EMERGENCY_OBS("Emergency Clinical Decision Unit", "OBSERVATION", 20);

    private final String unitName;
    private final String unitType;
    private final int totalBeds;

    HospitalUnit(String unitName, String unitType, int totalBeds) {
        this.unitName = unitName;
        this.unitType = unitType;
        this.totalBeds = totalBeds;
    }

    public String getUnitName() { return unitName; }
    public String getUnitType() { return unitType; }
    public int getTotalBeds() { return totalBeds; }
}
