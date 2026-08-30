package com.medtrack.circulatory.model;

/**
 * SCAI Cardiogenic Shock Classification.
 */
public enum ScaiShockStage {
    STAGE_E_EXTREMIS("Stage E (Extremis / Refractory Circulatory Collapse)", 1, true),
    STAGE_D_DETERIORATING("Stage D (Deteriorating / Non-Responder to Inotropes)", 2, true),
    STAGE_C_CLASSIC("Stage C (Classic Cardiogenic Shock requiring MCS/Inotropes)", 3, true),
    POST_IMPLANT_STABLE("Post-Implant Supported / Adequately Unloaded", 4, false),
    WEANING_TRIAL_CANDIDATE("Weaning & Explant Candidate", 5, false);

    private final String description;
    private final int severityRank;
    private final boolean requiresUrgentEscalation;

    ScaiShockStage(String description, int severityRank, boolean requiresUrgentEscalation) {
        this.description = description;
        this.severityRank = severityRank;
        this.requiresUrgentEscalation = requiresUrgentEscalation;
    }

    public String getDescription() { return description; }
    public int getSeverityRank() { return severityRank; }
    public boolean isRequiresUrgentEscalation() { return requiresUrgentEscalation; }
}
