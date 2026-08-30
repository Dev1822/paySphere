package com.medtrack.commandcenter.service;

import com.medtrack.commandcenter.dto.*;
import com.medtrack.commandcenter.model.AcuityLevel;
import com.medtrack.commandcenter.model.HospitalUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Enterprise Hospital Command Center & Bio-AI Predictive Patient Deterioration Service.
 *
 * Implements clinical decision support for:
 * 1. National Early Warning Score 2 (NEWS2) + dynamic component stratification.
 * 2. Shock Index (SI) & Modified Shock Index (MSI).
 * 3. Early Deterioration Index (EDI / continuous reserve score).
 * 4. 12h/24h ICU Escalation Probability forecasting.
 * 5. Step-Down & De-escalation readiness verification.
 */
public class HospitalCommandCenterService {

    /**
     * Calculate National Early Warning Score 2 (NEWS2).
     */
    public EarlyWarningScoreResult calculateNews2(double respRate, double spO2, double fio2,
                                                  double systolicBp, double heartRate,
                                                  int gcsScore, double tempC) {
        int score = 0;
        Map<String, Integer> breakdown = new HashMap<>();

        // 1. Respiratory Rate
        int rrPoints;
        if (respRate <= 8.0) rrPoints = 3;
        else if (respRate <= 11.0) rrPoints = 1;
        else if (respRate <= 20.0) rrPoints = 0;
        else if (respRate <= 24.0) rrPoints = 2;
        else rrPoints = 3;
        breakdown.put("respiratoryRate", rrPoints);
        score += rrPoints;

        // 2. SpO2 Scale 1
        int spo2Points;
        if (spO2 <= 91.0) spo2Points = 3;
        else if (spO2 <= 93.0) spo2Points = 2;
        else if (spO2 <= 95.0) spo2Points = 1;
        else spo2Points = 0;
        breakdown.put("spO2", spo2Points);
        score += spo2Points;

        // 3. Supplemental Oxygen
        int o2Points = fio2 > 0.21 ? 2 : 0;
        breakdown.put("supplementalOxygen", o2Points);
        score += o2Points;

        // 4. Systolic BP
        int sbpPoints;
        if (systolicBp <= 90.0) sbpPoints = 3;
        else if (systolicBp <= 100.0) sbpPoints = 2;
        else if (systolicBp <= 110.0) sbpPoints = 1;
        else if (systolicBp <= 219.0) sbpPoints = 0;
        else sbpPoints = 3;
        breakdown.put("systolicBp", sbpPoints);
        score += sbpPoints;

        // 5. Heart Rate
        int hrPoints;
        if (heartRate <= 40.0) hrPoints = 3;
        else if (heartRate <= 50.0) hrPoints = 1;
        else if (heartRate <= 90.0) hrPoints = 0;
        else if (heartRate <= 110.0) hrPoints = 1;
        else if (heartRate <= 130.0) hrPoints = 2;
        else hrPoints = 3;
        breakdown.put("heartRate", hrPoints);
        score += hrPoints;

        // 6. Consciousness (GCS < 15)
        int gcsPoints = gcsScore < 15 ? 3 : 0;
        breakdown.put("consciousness", gcsPoints);
        score += gcsPoints;

        // 7. Temperature
        int tempPoints;
        if (tempC <= 35.0) tempPoints = 3;
        else if (tempC <= 36.0) tempPoints = 1;
        else if (tempC <= 38.0) tempPoints = 0;
        else if (tempC <= 39.0) tempPoints = 1;
        else tempPoints = 2;
        breakdown.put("temperature", tempPoints);
        score += tempPoints;

        String riskTier = score >= 7 || rrPoints == 3 || sbpPoints == 3 || hrPoints == 3 ? "CRITICAL / HIGH RISK"
                : score >= 5 ? "MEDIUM RISK"
                : "LOW RISK";

        String frequency = score >= 7 ? "Continuous monitoring; reassess q30m"
                : score >= 5 ? "Hourly vital sign assessment"
                : "Serial monitoring q12h";

        String action = score >= 7 ? "Immediate clinical evaluation and consider Rapid Response Team activation."
                : score >= 5 ? "Urgent clinician review; optimize ward support."
                : "Routine inpatient nursing care.";

        return new EarlyWarningScoreResult(score, riskTier, frequency, action, breakdown);
    }

    /**
     * Calculate Shock Index (SI) and Modified Shock Index (MSI).
     */
    public double[] calculateShockIndices(double heartRate, double systolicBp, double meanArterialPressure) {
        if (systolicBp <= 0.0 || meanArterialPressure <= 0.0) {
            throw new IllegalArgumentException("Blood pressure parameters must be positive.");
        }

        double si = Math.round((heartRate / systolicBp) * 100.0) / 100.0;
        double msi = Math.round((heartRate / meanArterialPressure) * 100.0) / 100.0;

        return new double[]{si, msi};
    }

    /**
     * Calculate Early Deterioration Index (0 - 100).
     */
    public double calculateEarlyDeteriorationIndex(double respRate, double spO2, double systolicBp,
                                                  double heartRate, int gcsScore, double lactate,
                                                  double creatinine, double baselineCreatinine) {
        double score = 100.0;

        if (respRate > 24.0) score -= Math.min(25.0, (respRate - 24.0) * 3.5);
        if (spO2 < 95.0) score -= Math.min(20.0, (95.0 - spO2) * 3.0);
        if (systolicBp < 100.0) score -= Math.min(20.0, (100.0 - systolicBp) * 1.5);
        if (heartRate > 100.0) score -= Math.min(15.0, (heartRate - 100.0) * 0.6);
        if (gcsScore < 15) score -= (15 - gcsScore) * 5.0;
        if (lactate > 2.0) score -= Math.min(20.0, (lactate - 2.0) * 8.0);
        if (baselineCreatinine > 0 && creatinine > baselineCreatinine * 1.5) {
            score -= Math.min(15.0, (creatinine / baselineCreatinine - 1.0) * 10.0);
        }

        return Math.max(5.0, Math.min(100.0, Math.round(score * 10.0) / 10.0));
    }

    /**
     * Evaluate Step-Down Readiness.
     */
    public StepDownReadinessResult evaluateStepDownReadiness(String vasopressor, double fio2,
                                                             double lactate, int news2, double urineOutput) {
        int score = 100;
        List<String> barriers = new ArrayList<>();

        if (vasopressor != null && !vasopressor.trim().isEmpty() && !vasopressor.equalsIgnoreCase("None")) {
            score -= 40;
            barriers.add("Active vasopressor: " + vasopressor);
        }
        if (fio2 > 0.35) {
            score -= 20;
            barriers.add("High oxygen demand: FiO2 " + Math.round(fio2 * 100) + "%");
        }
        if (lactate > 1.8) {
            score -= 15;
            barriers.add("Elevated serum lactate (" + lactate + " mmol/L)");
        }
        if (news2 >= 4) {
            score -= 20;
            barriers.add("Elevated NEWS2 score (" + news2 + ")");
        }
        if (urineOutput < 30.0) {
            score -= 15;
            barriers.add("Oliguria (< 30 mL/h)");
        }

        int finalScore = Math.max(0, score);
        boolean isReady = finalScore >= 75 && barriers.isEmpty();

        String recommendation = isReady
                ? "Patient meets all clinical de-escalation benchmarks. Safe for floor transfer."
                : "Continue monitored care. Address active physiological barriers.";

        return new StepDownReadinessResult(finalScore, isReady, barriers, recommendation);
    }

    /**
     * Process full inpatient assessment.
     */
    public DeteriorationAssessmentResponse processAssessment(DeteriorationAssessmentRequest req) {
        EarlyWarningScoreResult news2 = calculateNews2(
                req.getRespRate(), req.getSpO2(), req.getFio2(),
                req.getSystolicBp(), req.getHeartRate(),
                req.getGcsScore(), req.getTempC()
        );

        double[] shock = calculateShockIndices(req.getHeartRate(), req.getSystolicBp(), req.getMeanArterialPressure());
        double si = shock[0];
        double msi = shock[1];
        boolean isSiCritical = si >= 0.9;

        double edi = calculateEarlyDeteriorationIndex(
                req.getRespRate(), req.getSpO2(), req.getSystolicBp(),
                req.getHeartRate(), req.getGcsScore(), req.getSerumLactate(),
                req.getSerumCreatinine(), req.getBaselineCreatinine()
        );

        double icu12h = edi < 30.0 ? 85.0 : edi < 45.0 ? 65.0 : edi < 65.0 ? 35.0 : 5.0;
        double icu24h = Math.min(98.0, icu12h * 1.15);

        List<String> riskFactors = new ArrayList<>();
        if (req.getRespRate() > 24.0) riskFactors.add("Tachypnea (RR " + req.getRespRate() + ")");
        if (isSiCritical) riskFactors.add("Critical Shock Index (" + si + ")");
        if (req.getSerumLactate() > 2.0) riskFactors.add("Lactatemia (" + req.getSerumLactate() + " mmol/L)");
        if (news2.getTotalScore() >= 5) riskFactors.add("High NEWS2 (" + news2.getTotalScore() + ")");

        boolean rrtIndicated = news2.getTotalScore() >= 7 || edi < 35.0 || isSiCritical;
        String trajectory = edi < 30.0 ? "CRITICAL_COLLAPSE" : edi < 45.0 ? "RAPID_DETERIORATION" : "STABLE";

        PredictiveEscalationResult predResult = new PredictiveEscalationResult(
                edi, trajectory, icu12h, icu24h, si, msi, isSiCritical, rrtIndicated, riskFactors
        );

        StepDownReadinessResult stepDown = evaluateStepDownReadiness(
                req.getActiveVasopressor(), req.getFio2(), req.getSerumLactate(),
                news2.getTotalScore(), req.getUrineOutputMlPerHour()
        );

        AcuityLevel acuity = rrtIndicated ? AcuityLevel.CRITICAL_DETERIORATION
                : icu12h >= 60.0 ? AcuityLevel.IMMINENT_ICU_ESCALATION
                : news2.getTotalScore() >= 5 ? AcuityLevel.UNSTABLE_PROGRESSION
                : stepDown.isReadyForDeescalation() ? AcuityLevel.STEP_DOWN_READY
                : AcuityLevel.MODERATE_ACUITY;

        List<String> alerts = new ArrayList<>();
        if (rrtIndicated) alerts.add("CRITICAL: Rapid Response Team Activation Indicated");
        if (isSiCritical) alerts.add("ALERT: Elevated Shock Index indicates occult hypoperfusion");
        if (news2.getTotalScore() >= 7) alerts.add("CRITICAL: NEWS2 Score >= 7 requires emergency medical evaluation");

        DeteriorationAssessmentResponse resp = new DeteriorationAssessmentResponse();
        resp.setPatientId(req.getPatientId());
        resp.setUnit(req.getUnit() != null ? req.getUnit() : HospitalUnit.MICU);
        resp.setAcuityLevel(acuity);
        resp.setNews2Result(news2);
        resp.setPredictiveResult(predResult);
        resp.setStepDownResult(stepDown);
        resp.setActiveClinicalAlerts(alerts);

        return resp;
    }
}
