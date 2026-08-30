package com.medtrack.pulmonary.model;

/**
 * Berlin Definition ARDS Severity Classifications.
 */
public enum ArdsSeverity {
    SEVERE_ARDS("Severe ARDS (PaO2/FiO2 <= 100 with PEEP >= 5 cmH2O)", 1, true),
    MODERATE_ARDS("Moderate ARDS (100 < PaO2/FiO2 <= 200 with PEEP >= 5 cmH2O)", 2, true),
    MILD_ARDS("Mild ARDS (200 < PaO2/FiO2 <= 300 with PEEP >= 5 cmH2O)", 3, false),
    AT_RISK_LUNG_INJURY("At Risk for Lung Injury / VILI", 4, false),
    WEANING_CANDIDATE("Weaning & Extubation Candidate", 5, false);

    private final String description;
    private final int clinicalPriority;
    private final boolean requiresSpecializedRescueProtocol;

    ArdsSeverity(String description, int clinicalPriority, boolean requiresSpecializedRescueProtocol) {
        this.description = description;
        this.clinicalPriority = clinicalPriority;
        this.requiresSpecializedRescueProtocol = requiresSpecializedRescueProtocol;
    }

    public String getDescription() {
        return description;
    }

    public int getClinicalPriority() {
        return clinicalPriority;
    }

    public boolean isRequiresSpecializedRescueProtocol() {
        return requiresSpecializedRescueProtocol;
    }
}
