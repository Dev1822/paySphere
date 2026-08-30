package com.medtrack.nicu.dto;

import java.time.Instant;
import java.util.List;

public class NeonatalAssessmentResponse {
    private String patientId;
    private Instant evaluatedAt;
    private int nSofaScore;
    private String nSofaRiskTier;
    private double oxygenationIndex;
    private String oxygenationInterpretation;
    private boolean ecmoCandidate;
    private boolean inoRecommended;
    private double ductalDelta;
    private String ductalShuntInterpretation;
    private double inotropicScoreVIS;
    private String visRiskTier;
    private HypothermiaProtocolStatus hypothermiaStatus;
    private List<String> activeClinicalAlerts;
    private List<String> recommendedInterventions;

    public NeonatalAssessmentResponse() {
        this.evaluatedAt = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public Instant getEvaluatedAt() { return evaluatedAt; }
    public void setEvaluatedAt(Instant evaluatedAt) { this.evaluatedAt = evaluatedAt; }

    public int getNSofaScore() { return nSofaScore; }
    public void setNSofaScore(int nSofaScore) { this.nSofaScore = nSofaScore; }

    public String getNSofaRiskTier() { return nSofaRiskTier; }
    public void setNSofaRiskTier(String nSofaRiskTier) { this.nSofaRiskTier = nSofaRiskTier; }

    public double getOxygenationIndex() { return oxygenationIndex; }
    public void setOxygenationIndex(double oxygenationIndex) { this.oxygenationIndex = oxygenationIndex; }

    public String getOxygenationInterpretation() { return oxygenationInterpretation; }
    public void setOxygenationInterpretation(String oxygenationInterpretation) { this.oxygenationInterpretation = oxygenationInterpretation; }

    public boolean isEcmoCandidate() { return ecmoCandidate; }
    public void setEcmoCandidate(boolean ecmoCandidate) { this.ecmoCandidate = ecmoCandidate; }

    public boolean isInoRecommended() { return inoRecommended; }
    public void setInoRecommended(boolean inoRecommended) { this.inoRecommended = inoRecommended; }

    public double getDuctalDelta() { return ductalDelta; }
    public void setDuctalDelta(double ductalDelta) { this.ductalDelta = ductalDelta; }

    public String getDuctalShuntInterpretation() { return ductalShuntInterpretation; }
    public void setDuctalShuntInterpretation(String ductalShuntInterpretation) { this.ductalShuntInterpretation = ductalShuntInterpretation; }

    public double getInotropicScoreVIS() { return inotropicScoreVIS; }
    public void setInotropicScoreVIS(double inotropicScoreVIS) { this.inotropicScoreVIS = inotropicScoreVIS; }

    public String getVisRiskTier() { return visRiskTier; }
    public void setVisRiskTier(String visRiskTier) { this.visRiskTier = visRiskTier; }

    public HypothermiaProtocolStatus getHypothermiaStatus() { return hypothermiaStatus; }
    public void setHypothermiaStatus(HypothermiaProtocolStatus hypothermiaStatus) { this.hypothermiaStatus = hypothermiaStatus; }

    public List<String> getActiveClinicalAlerts() { return activeClinicalAlerts; }
    public void setActiveClinicalAlerts(List<String> activeClinicalAlerts) { this.activeClinicalAlerts = activeClinicalAlerts; }

    public List<String> getRecommendedInterventions() { return recommendedInterventions; }
    public void setRecommendedInterventions(List<String> recommendedInterventions) { this.recommendedInterventions = recommendedInterventions; }
}
