package com.medtrack.pulmonary.dto;

import java.time.Instant;
import java.util.List;

/**
 * Comprehensive clinical pulmonary response payload.
 */
public class PulmonaryAssessmentResponse {

    private String patientId;
    private double predictedBodyWeightKg;
    private double currentVtMlPerKgPbw;
    private double target4mLkg;
    private double target6mLkg;
    private double target8mLkg;
    private double ventilatoryRatio;
    private ArdsClassificationResult ardsResult;
    private MechanicalPowerResult mechanicalPowerResult;
    private WeaningReadinessResult weaningResult;
    private List<String> activeClinicalAlerts;
    private Instant assessmentTimestamp;

    public PulmonaryAssessmentResponse() {
        this.assessmentTimestamp = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public double getPredictedBodyWeightKg() { return predictedBodyWeightKg; }
    public void setPredictedBodyWeightKg(double predictedBodyWeightKg) { this.predictedBodyWeightKg = predictedBodyWeightKg; }

    public double getCurrentVtMlPerKgPbw() { return currentVtMlPerKgPbw; }
    public void setCurrentVtMlPerKgPbw(double currentVtMlPerKgPbw) { this.currentVtMlPerKgPbw = currentVtMlPerKgPbw; }

    public double getTarget4mLkg() { return target4mLkg; }
    public void setTarget4mLkg(double target4mLkg) { this.target4mLkg = target4mLkg; }

    public double getTarget6mLkg() { return target6mLkg; }
    public void setTarget6mLkg(double target6mLkg) { this.target6mLkg = target6mLkg; }

    public double getTarget8mLkg() { return target8mLkg; }
    public void setTarget8mLkg(double target8mLkg) { this.target8mLkg = target8mLkg; }

    public double getVentilatoryRatio() { return ventilatoryRatio; }
    public void setVentilatoryRatio(double ventilatoryRatio) { this.ventilatoryRatio = ventilatoryRatio; }

    public ArdsClassificationResult getArdsResult() { return ardsResult; }
    public void setArdsResult(ArdsClassificationResult ardsResult) { this.ardsResult = ardsResult; }

    public MechanicalPowerResult getMechanicalPowerResult() { return mechanicalPowerResult; }
    public void setMechanicalPowerResult(MechanicalPowerResult mechanicalPowerResult) { this.mechanicalPowerResult = mechanicalPowerResult; }

    public WeaningReadinessResult getWeaningResult() { return weaningResult; }
    public void setWeaningResult(WeaningReadinessResult weaningResult) { this.weaningResult = weaningResult; }

    public List<String> getActiveClinicalAlerts() { return activeClinicalAlerts; }
    public void setActiveClinicalAlerts(List<String> activeClinicalAlerts) { this.activeClinicalAlerts = activeClinicalAlerts; }

    public Instant getAssessmentTimestamp() { return assessmentTimestamp; }
    public void setAssessmentTimestamp(Instant assessmentTimestamp) { this.assessmentTimestamp = assessmentTimestamp; }
}
