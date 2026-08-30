package com.medtrack.nephrology.service;

import com.medtrack.nephrology.dto.CitrateAnticoagulationStatus;
import com.medtrack.nephrology.dto.CrrtAssessmentRequest;
import com.medtrack.nephrology.dto.CrrtAssessmentResponse;
import com.medtrack.nephrology.model.CrrtTelemetryReading;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Enterprise Nephrology & Continuous Renal Replacement Therapy (CRRT) Decision Support Service.
 *
 * Implements clinical algorithms for:
 * - KDIGO 2012 / 2024 Acute Kidney Injury (AKI) Staging
 * - Delivered Effluent Dose calculation (KDIGO target: 20 - 25 mL/kg/h)
 * - Transmembrane Pressure (TMP) & Filter Delta-P Clotting Sentry
 * - Regional Citrate Anticoagulation (RCA) and Citrate Lock / Toxicity Sentry (Total Ca / Ionized Ca ratio >= 2.5)
 * - Acid-Base and Refractory Hyperkalemia Emergency RRT Triggers
 */
public class NephrologyCrrtService {

    /**
     * Calculate KDIGO AKI Stage (0 - 3).
     */
    public int calculateKdigoStage(double baselineCreatinine, double currentCreatinine, double urineOutputMlKgHr, boolean onRRT) {
        if (onRRT) return 3;

        double ratio = baselineCreatinine > 0 ? currentCreatinine / baselineCreatinine : 1.0;
        double absoluteIncrease = currentCreatinine - baselineCreatinine;

        if (ratio >= 3.0 || currentCreatinine >= 4.0 || urineOutputMlKgHr < 0.3) {
            return 3;
        }
        if (ratio >= 2.0 || (urineOutputMlKgHr < 0.5 && urineOutputMlKgHr >= 0.3)) {
            return 2;
        }
        if (ratio >= 1.5 || absoluteIncrease >= 0.3 || urineOutputMlKgHr < 0.5) {
            return 1;
        }
        return 0;
    }

    /**
     * Compute Effluent Dose (mL/kg/h).
     * Formula: Dose = (Q_dialysate + Q_replacement + Q_netUF) / Weight_kg
     */
    public double calculateEffluentDose(double qDialysateMlH, double qReplacementMlH, double qNetUfMlH, double weightKg) {
        if (weightKg <= 0) {
            throw new IllegalArgumentException("Patient weight must be greater than zero");
        }
        double totalEffluent = qDialysateMlH + qReplacementMlH + qNetUfMlH;
        return Math.round((totalEffluent / weightKg) * 10.0) / 10.0;
    }

    /**
     * Comprehensive CRRT and renal assessment engine.
     */
    public CrrtAssessmentResponse evaluateCrrtSession(CrrtAssessmentRequest req) {
        CrrtAssessmentResponse res = new CrrtAssessmentResponse();
        res.setPatientId(req.getPatientId());
        res.setEvaluatedAt(Instant.now());

        List<String> alerts = new ArrayList<>();
        List<String> adjustments = new ArrayList<>();

        // 1. KDIGO AKI Staging
        int stage = calculateKdigoStage(req.getBaselineCreatinine(), req.getCurrentCreatinine(), req.getUrineOutputMlKgHr(), true);
        res.setKdigoStage(stage);
        res.setKdigoInterpretation("KDIGO Stage " + stage + " Acute Kidney Injury on active CRRT support");

        // 2. Circuit Telemetry Evaluation
        CrrtTelemetryReading t = req.getCircuitTelemetry();
        if (t != null) {
            double effluentDose = calculateEffluentDose(
                    t.getDialysateFlowRateQd(),
                    t.getReplacementPreFilterRate() + t.getReplacementPostFilterRate(),
                    t.getNetUltrafiltrationRate(),
                    req.getPatientWeightKg()
            );
            res.setEffluentDoseMlKgHr(effluentDose);

            if (effluentDose < 20.0) {
                res.setEffluentDoseTargetStatus("UNDER_DOSED (< 20 mL/kg/h)");
                alerts.add("WARNING: Delivered effluent dose " + effluentDose + " mL/kg/h below KDIGO target 20-25 mL/kg/h.");
                adjustments.add("Increase dialysate or replacement fluid flow to achieve target 20-25 mL/kg/h");
            } else if (effluentDose > 30.0) {
                res.setEffluentDoseTargetStatus("HIGH_DOSE (> 30 mL/kg/h)");
            } else {
                res.setEffluentDoseTargetStatus("OPTIMAL (20 - 25 mL/kg/h)");
            }

            // Transmembrane Pressure & Filter Clotting Sentry
            res.setTransmembranePressure(t.getTransmembranePressure());
            res.setFilterPressureDrop(t.getFilterPressureDrop());

            if (t.getTransmembranePressure() >= 250.0 || t.getFilterPressureDrop() >= 150.0) {
                res.setCircuitClottingRisk("CRITICAL_CLOTTING_IMMINENT");
                alerts.add("CRITICAL: High TMP (" + t.getTransmembranePressure() + " mmHg) or Filter Drop Delta-P (" + t.getFilterPressureDrop() + " mmHg). Hemofilter clotting imminent.");
                adjustments.add("Prepare replacement CRRT circuit and check vascular access patency");
            } else if (t.getTransmembranePressure() >= 180.0 || t.getFilterPressureDrop() >= 100.0) {
                res.setCircuitClottingRisk("MODERATE_MEMBRANE_FOULING");
                alerts.add("WARNING: Rising membrane resistance. Monitor post-filter calcium and anticoagulation.");
            } else {
                res.setCircuitClottingRisk("NORMAL_MEMBRANE_PATENCY");
            }

            // Regional Citrate Anticoagulation (RCA) Sentry
            double postFilterIca = t.getPostFilterIonizedCalcium();
            double sysIca = t.getSystemicIonizedCalcium();
            double totalCa = t.getTotalSerumCalcium();
            double ratio = (sysIca > 0) ? (totalCa / (sysIca * 4.0)) : 1.0; // Normalized total-to-ionized ratio

            List<String> rcaAlerts = new ArrayList<>();
            boolean citrateTox = ratio >= 2.5;

            if (citrateTox) {
                rcaAlerts.add("CRITICAL: Total Ca / Ionized Ca ratio >= 2.5 (" + String.format("%.2f", ratio) + "). Citrate accumulation / toxicity detected.");
                alerts.add("CRITICAL: Citrate toxicity sentry triggered (Total/Ionized Ca ratio >= 2.5). Decrease citrate infusion rate.");
                adjustments.add("Decrease pre-filter citrate infusion by 20% and increase dialysate flow");
            }

            if (postFilterIca > 0.40) {
                rcaAlerts.add("WARNING: Post-filter iCa " + postFilterIca + " mmol/L > target 0.25-0.40. Insufficient circuit anticoagulation.");
                adjustments.add("Increase citrate infusion rate to target post-filter iCa 0.25 - 0.40 mmol/L");
            } else if (postFilterIca < 0.20) {
                rcaAlerts.add("WARNING: Post-filter iCa " + postFilterIca + " mmol/L < 0.25. Excessive citrate dosing.");
            }

            CitrateAnticoagulationStatus rca = new CitrateAnticoagulationStatus(
                    true,
                    postFilterIca,
                    sysIca,
                    Math.round(ratio * 100.0) / 100.0,
                    citrateTox,
                    postFilterIca >= 0.25 && postFilterIca <= 0.40 ? "ADEQUATE" : "SUBOPTIMAL",
                    rcaAlerts
            );
            res.setCitrateStatus(rca);
        }

        // 3. Metabolic Emergency Triggers
        if (req.getSerumPotassium() >= 6.5) {
            alerts.add("CRITICAL: Severe refractory hyperkalemia (" + req.getSerumPotassium() + " mmol/L). Immediate potassium-free dialysate verification.");
        }
        if (req.getArterialPh() < 7.15) {
            alerts.add("HIGH: Severe metabolic acidosis (pH " + req.getArterialPh() + "). Increase bicarbonate replacement flow.");
        }

        res.setActiveClinicalAlerts(alerts);
        res.setRecommendedAdjustments(adjustments);

        return res;
    }
}
