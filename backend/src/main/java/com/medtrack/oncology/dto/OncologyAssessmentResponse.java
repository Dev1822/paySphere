package com.medtrack.oncology.dto;

import java.time.Instant;
import java.util.List;

public class OncologyAssessmentResponse {
    private String patientId;
    private Instant evaluatedAt;
    private boolean immunotherapyCandidate;
    private String immunotherapyRationale;
    private boolean parpInhibitorCandidate;
    private String parpRationale;
    private String tmbClassification; // TMB_HIGH, TMB_INTERMEDIATE, TMB_LOW
    private List<TargetedTherapyRecommendation> prioritizedTherapies;
    private List<String> genomicResistanceAlerts;
    private List<String> clinicalTrialEligibilityMatches;
    private String molecularTumorBoardSummary;

    public OncologyAssessmentResponse() {
        this.evaluatedAt = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public Instant getEvaluatedAt() { return evaluatedAt; }
    public void setEvaluatedAt(Instant evaluatedAt) { this.evaluatedAt = evaluatedAt; }

    public boolean isImmunotherapyCandidate() { return immunotherapyCandidate; }
    public void setImmunotherapyCandidate(boolean immunotherapyCandidate) { this.immunotherapyCandidate = immunotherapyCandidate; }

    public String getImmunotherapyRationale() { return immunotherapyRationale; }
    public void setImmunotherapyRationale(String immunotherapyRationale) { this.immunotherapyRationale = immunotherapyRationale; }

    public boolean isParpInhibitorCandidate() { return parpInhibitorCandidate; }
    public void setParpInhibitorCandidate(boolean parpInhibitorCandidate) { this.parpInhibitorCandidate = parpInhibitorCandidate; }

    public String getParpRationale() { return parpRationale; }
    public void setParpRationale(String parpRationale) { this.parpRationale = parpRationale; }

    public String getTmbClassification() { return tmbClassification; }
    public void setTmbClassification(String tmbClassification) { this.tmbClassification = tmbClassification; }

    public List<TargetedTherapyRecommendation> getPrioritizedTherapies() { return prioritizedTherapies; }
    public void setPrioritizedTherapies(List<TargetedTherapyRecommendation> prioritizedTherapies) { this.prioritizedTherapies = prioritizedTherapies; }

    public List<String> getGenomicResistanceAlerts() { return genomicResistanceAlerts; }
    public void setGenomicResistanceAlerts(List<String> genomicResistanceAlerts) { this.genomicResistanceAlerts = genomicResistanceAlerts; }

    public List<String> getClinicalTrialEligibilityMatches() { return clinicalTrialEligibilityMatches; }
    public void setClinicalTrialEligibilityMatches(List<String> clinicalTrialEligibilityMatches) { this.clinicalTrialEligibilityMatches = clinicalTrialEligibilityMatches; }

    public String getMolecularTumorBoardSummary() { return molecularTumorBoardSummary; }
    public void setMolecularTumorBoardSummary(String molecularTumorBoardSummary) { this.molecularTumorBoardSummary = molecularTumorBoardSummary; }
}
