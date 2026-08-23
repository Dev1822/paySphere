package com.medtrack.immunotherapy.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Cellular Immunotherapy CAR-T Toxicity Service.
 *
 * Implements ASTCT Consensus Grading for Cytokine Release Syndrome (CRS)
 * and Immune Effector Cell-Associated Neurotoxicity Syndrome (ICANS),
 * ICE cognitive assessment evaluations, and Tocilizumab/corticosteroid dosing pathways.
 */
public class CartImmunotherapyService {

    public static class AstctCrsResult {
        private final int grade;
        private final String gradeTitle;
        private final String clinicalRationale;
        private final String recommendedIntervention;

        public AstctCrsResult(int grade, String gradeTitle, String clinicalRationale, String recommendedIntervention) {
            this.grade = grade;
            this.gradeTitle = gradeTitle;
            this.clinicalRationale = clinicalRationale;
            this.recommendedIntervention = recommendedIntervention;
        }

        public int getGrade() { return grade; }
        public String getGradeTitle() { return gradeTitle; }
        public String getClinicalRationale() { return clinicalRationale; }
        public String getRecommendedIntervention() { return recommendedIntervention; }
    }

    public static class AstctIcansResult {
        private final int grade;
        private final String gradeTitle;
        private final int iceScore;
        private final String managementProtocol;

        public AstctIcansResult(int grade, String gradeTitle, int iceScore, String managementProtocol) {
            this.grade = grade;
            this.gradeTitle = gradeTitle;
            this.iceScore = iceScore;
            this.managementProtocol = managementProtocol;
        }

        public int getGrade() { return grade; }
        public String getGradeTitle() { return gradeTitle; }
        public int getIceScore() { return iceScore; }
        public String getManagementProtocol() { return managementProtocol; }
    }

    /**
     * Determine ASTCT CRS Grade based on core temperature, hypotension, and hypoxia.
     */
    public AstctCrsResult evaluateCrsGrade(double tempC, boolean fluidResponsiveHypotension,
                                          boolean singleVasopressor, boolean multipleVasopressors,
                                          boolean lowFlowOxygen, boolean highFlowOrBipap, boolean intubatedVentilated) {
        if (tempC < 38.0 && !singleVasopressor && !multipleVasopressors && !highFlowOrBipap && !intubatedVentilated) {
            return new AstctCrsResult(0, "No CRS", "Patient afebrile without end-organ compromise", "Standard monitoring");
        }

        int grade = 1;
        String rationale = "Fever present (>= 38.0 C). ";

        if (multipleVasopressors || intubatedVentilated) {
            grade = 4;
            rationale += "Grade 4: Life-threatening multi-vasopressor shock or mechanical ventilation.";
        } else if (singleVasopressor || highFlowOrBipap) {
            grade = 3;
            rationale += "Grade 3: Single vasopressor or high-flow nasal cannula/BiPAP.";
        } else if (fluidResponsiveHypotension || lowFlowOxygen) {
            grade = 2;
            rationale += "Grade 2: Fluid-responsive hypotension or low-flow nasal cannula.";
        } else {
            rationale += "Grade 1: Isolated fever without hypotension or hypoxia.";
        }

        String action = switch (grade) {
            case 4 -> "Emergent ICU resuscitation, Methylprednisolone 1000mg/day pulse, consider Anakinra 100-200mg q6h.";
            case 3 -> "ICU admission, repeat Tocilizumab 8mg/kg IV (max 800mg), initiate Dexamethasone 10-20mg IV q6h.";
            case 2 -> "Initiate Tocilizumab 8mg/kg IV (max 800mg) x 1 dose. Monitor ICU transfer criteria.";
            default -> "Supportive antipyretics (Acetaminophen), diagnostic cytokine panel, blood cultures.";
        };

        return new AstctCrsResult(grade, "ASTCT Grade " + grade + " CRS", rationale, action);
    }

    /**
     * Determine ASTCT ICANS Grade based on 10-point ICE score and neurological red flags.
     */
    public AstctIcansResult evaluateIcansGrade(int iceScore, boolean comaOrStatusEpilepticus,
                                              boolean stuporOrMotorDeficits, boolean somnolentArousable) {
        int grade;
        String title;
        String action;

        if (comaOrStatusEpilepticus || iceScore == 0) {
            grade = 4;
            title = "ASTCT Grade 4 ICANS (Life-Threatening)";
            action = "Airway protection, hyperosmolar therapy for cerebral edema, Methylprednisolone 1000mg pulse.";
        } else if (stuporOrMotorDeficits || iceScore <= 2) {
            grade = 3;
            title = "ASTCT Grade 3 ICANS (Severe)";
            action = "Transfer to Neuro-ICU, Dexamethasone 20mg IV q6h, continuous EEG, stat brain MRI.";
        } else if (somnolentArousable || (iceScore >= 3 && iceScore <= 6)) {
            grade = 2;
            title = "ASTCT Grade 2 ICANS (Moderate)";
            action = "Dexamethasone 10mg IV q6h, non-contrast head CT, seizure prophylaxis with Levetiracetam.";
        } else if (iceScore >= 7 && iceScore <= 9) {
            grade = 1;
            title = "ASTCT Grade 1 ICANS (Mild)";
            action = "Neurology consultation, ICE assessment q8h, levetiracetam seizure prophylaxis.";
        } else {
            grade = 0;
            title = "No ICANS Detected";
            action = "Routine cognitive screening every 12 hours.";
        }

        return new AstctIcansResult(grade, title, iceScore, action);
    }
}
