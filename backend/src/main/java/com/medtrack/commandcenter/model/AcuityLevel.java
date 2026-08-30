package com.medtrack.commandcenter.model;

/**
 * Hospital-wide Clinical Deterioration Acuity Levels.
 */
public enum AcuityLevel {
    CRITICAL_DETERIORATION("Critical Deterioration (Immediate ICU / RRT Dispatch)", 1, true),
    IMMINENT_ICU_ESCALATION("High Predictive Risk (ICU Escalation Likely)", 2, true),
    UNSTABLE_PROGRESSION("Unstable Progression (Early Warning Alert)", 3, false),
    MODERATE_ACUITY("Moderate Acuity (Monitored Ward)", 4, false),
    CLINICALLY_STABLE("Clinically Stable (Low Acuity)", 5, false),
    STEP_DOWN_READY("Step-Down / Discharge Ready", 6, false);

    private final String description;
    private final int priority;
    private final boolean requiresImmediateIntervention;

    AcuityLevel(String description, int priority, boolean requiresImmediateIntervention) {
        this.description = description;
        this.priority = priority;
        this.requiresImmediateIntervention = requiresImmediateIntervention;
    }

    public String getDescription() { return description; }
    public int getPriority() { return priority; }
    public boolean isRequiresImmediateIntervention() { return requiresImmediateIntervention; }
}
