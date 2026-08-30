package com.medtrack.circulatory.dto;

import com.medtrack.circulatory.model.McsDeviceType;
import com.medtrack.circulatory.model.ScaiShockStage;
import java.time.Instant;
import java.util.List;

/**
 * Full Mechanical Circulatory Support clinical response.
 */
public class CirculatoryAssessmentResponse {

    private String patientId;
    private McsDeviceType deviceType;
    private ScaiShockStage scaiStage;
    private CardiacPowerOutputResult cpoResult;
    private PapiEvaluationResult papiResult;
    private SuctionRiskResult suctionResult;
    private List<String> activeClinicalAlerts;
    private Instant assessmentTimestamp;

    public CirculatoryAssessmentResponse() {
        this.assessmentTimestamp = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public McsDeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(McsDeviceType deviceType) { this.deviceType = deviceType; }

    public ScaiShockStage getScaiStage() { return scaiStage; }
    public void setScaiStage(ScaiShockStage scaiStage) { this.scaiStage = scaiStage; }

    public CardiacPowerOutputResult getCpoResult() { return cpoResult; }
    public void setCpoResult(CardiacPowerOutputResult cpoResult) { this.cpoResult = cpoResult; }

    public PapiEvaluationResult getPapiResult() { return papiResult; }
    public void setPapiResult(PapiEvaluationResult papiResult) { this.papiResult = papiResult; }

    public SuctionRiskResult getSuctionResult() { return suctionResult; }
    public void setSuctionResult(SuctionRiskResult suctionResult) { this.suctionResult = suctionResult; }

    public List<String> getActiveClinicalAlerts() { return activeClinicalAlerts; }
    public void setActiveClinicalAlerts(List<String> activeClinicalAlerts) { this.activeClinicalAlerts = activeClinicalAlerts; }

    public Instant getAssessmentTimestamp() { return assessmentTimestamp; }
    public void setAssessmentTimestamp(Instant assessmentTimestamp) { this.assessmentTimestamp = assessmentTimestamp; }
}
