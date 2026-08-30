package com.medtrack.commandcenter.dto;

import com.medtrack.commandcenter.model.AcuityLevel;
import com.medtrack.commandcenter.model.HospitalUnit;
import java.time.Instant;
import java.util.List;

/**
 * Full Hospital Command Center clinical assessment response.
 */
public class DeteriorationAssessmentResponse {

    private String patientId;
    private HospitalUnit unit;
    private AcuityLevel acuityLevel;
    private EarlyWarningScoreResult news2Result;
    private PredictiveEscalationResult predictiveResult;
    private StepDownReadinessResult stepDownResult;
    private List<String> activeClinicalAlerts;
    private Instant assessmentTimestamp;

    public DeteriorationAssessmentResponse() {
        this.assessmentTimestamp = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public HospitalUnit getUnit() { return unit; }
    public void setUnit(HospitalUnit unit) { this.unit = unit; }

    public AcuityLevel getAcuityLevel() { return acuityLevel; }
    public void setAcuityLevel(AcuityLevel acuityLevel) { this.acuityLevel = acuityLevel; }

    public EarlyWarningScoreResult getNews2Result() { return news2Result; }
    public void setNews2Result(EarlyWarningScoreResult news2Result) { this.news2Result = news2Result; }

    public PredictiveEscalationResult getPredictiveResult() { return predictiveResult; }
    public void setPredictiveResult(PredictiveEscalationResult predictiveResult) { this.predictiveResult = predictiveResult; }

    public StepDownReadinessResult getStepDownResult() { return stepDownResult; }
    public void setStepDownResult(StepDownReadinessResult stepDownResult) { this.stepDownResult = stepDownResult; }

    public List<String> getActiveClinicalAlerts() { return activeClinicalAlerts; }
    public void setActiveClinicalAlerts(List<String> activeClinicalAlerts) { this.activeClinicalAlerts = activeClinicalAlerts; }

    public Instant getAssessmentTimestamp() { return assessmentTimestamp; }
    public void setAssessmentTimestamp(Instant assessmentTimestamp) { this.assessmentTimestamp = assessmentTimestamp; }
}
