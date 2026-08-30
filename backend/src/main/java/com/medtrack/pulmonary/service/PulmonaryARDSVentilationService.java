package com.medtrack.pulmonary.service;

import com.medtrack.pulmonary.dto.*;
import com.medtrack.pulmonary.model.ArdsSeverity;
import java.util.ArrayList;
import java.util.List;

/**
 * Enterprise Pulmonary Critical Care & Mechanical Ventilation Service.
 *
 * Implements clinical decision algorithms for:
 * 1. Berlin Definition ARDS Staging (Mild, Moderate, Severe).
 * 2. ARDSNet Low Tidal Volume Ventilation (LTVV) protocol (4-8 mL/kg PBW).
 * 3. Driving Pressure (ΔP = Pplat - PEEP) monitoring with target < 14 cmH2O.
 * 4. Gattinoni Mechanical Power of Ventilation (MP) calculation.
 * 5. Ventilatory Ratio (VR) dead space estimation.
 * 6. Rapid Shallow Breathing Index (RSBI) spontaneous breathing trial scoring.
 */
public class PulmonaryARDSVentilationService {

    /**
     * Compute Predicted Body Weight (PBW) in kg using Devine Formula.
     */
    public double calculatePredictedBodyWeight(double heightCm, String sex) {
        if (heightCm < 100.0 || heightCm > 250.0) {
            throw new IllegalArgumentException("Height must be between 100 and 250 cm.");
        }

        boolean isMale = sex != null && sex.trim().toUpperCase().startsWith("M");
        double baseWeight = isMale ? 50.0 : 45.5;
        double pbw = baseWeight + 0.91 * (heightCm - 152.4);

        return Math.round(Math.max(25.0, pbw) * 10.0) / 10.0;
    }

    /**
     * Compute Driving Pressure (ΔP).
     * Formula: ΔP = Pplat - PEEP
     */
    public double calculateDrivingPressure(double plateauPressure, double peep) {
        if (plateauPressure < peep) {
            throw new IllegalArgumentException("Plateau pressure cannot be lower than PEEP.");
        }
        return Math.round((plateauPressure - peep) * 10.0) / 10.0;
    }

    /**
     * Compute Static Compliance (Cstat).
     * Formula: Cstat = Vt / (Pplat - PEEP)
     */
    public double calculateStaticCompliance(double tidalVolumeMl, double plateauPressure, double peep) {
        double deltaP = plateauPressure - peep;
        if (deltaP <= 0.0) {
            throw new IllegalArgumentException("Plateau pressure must exceed PEEP to calculate compliance.");
        }
        return Math.round((tidalVolumeMl / deltaP) * 10.0) / 10.0;
    }

    /**
     * Compute Gattinoni Mechanical Power of Ventilation (J/min).
     * Formula: MP = 0.098 * RR * Vt(L) * [Ppeak - 0.5 * (Pplat - PEEP)]
     */
    public MechanicalPowerResult evaluateMechanicalPower(int rr, double vtMl, double pPeak, double pPlat, double peep) {
        if (rr <= 0 || vtMl <= 0 || pPeak <= 0 || pPlat <= 0) {
            throw new IllegalArgumentException("Ventilator parameters must be positive non-zero values.");
        }

        double vtLiters = vtMl / 1000.0;
        double deltaP = calculateDrivingPressure(pPlat, peep);
        double mp = 0.098 * rr * vtLiters * (pPeak - 0.5 * deltaP);
        double roundedMp = Math.round(mp * 10.0) / 10.0;

        double cstat = calculateStaticCompliance(vtMl, pPlat, peep);
        boolean isProtectiveDeltaP = deltaP < 14.0;
        boolean isCriticalVili = roundedMp >= 27.0;

        String riskCategory = roundedMp >= 27.0 ? "CRITICAL_VILI_RISK"
                : roundedMp >= 17.0 ? "MODERATE_VILI_RISK"
                : "LOW_VILI_RISK";

        String complianceInterp = cstat < 20.0 ? "Severely reduced compliance (< 20 mL/cmH2O) - 'Baby Lung'"
                : cstat < 35.0 ? "Moderately reduced compliance (20-35 mL/cmH2O)"
                : cstat < 50.0 ? "Mildly reduced compliance (35-50 mL/cmH2O)"
                : "Normal static compliance (> 50 mL/cmH2O)";

        String rec = isCriticalVili
                ? "Reduce respiratory rate and tidal volume immediately. Target ΔP < 14 cmH2O to prevent volutrauma."
                : roundedMp >= 17.0
                ? "Monitor driving pressure and compliance closely. Re-evaluate PEEP titration."
                : "Ventilator mechanics are within safe lung-protective thresholds.";

        return new MechanicalPowerResult(roundedMp, riskCategory, isCriticalVili, deltaP,
                isProtectiveDeltaP, cstat, complianceInterp, rec);
    }

    /**
     * Compute Ventilatory Ratio (VR).
     * Formula: VR = [Minute Ventilation (mL/min) * PaCO2] / [Predicted MV (mL/min) * 37.5]
     */
    public double calculateVentilatoryRatio(double minuteVentilationLiters, double paco2, double pbwKg) {
        if (minuteVentilationLiters <= 0 || paco2 <= 0 || pbwKg <= 0) {
            throw new IllegalArgumentException("Invalid physiological inputs for Ventilatory Ratio.");
        }

        double mvMl = minuteVentilationLiters * 1000.0;
        double predMvMl = pbwKg * 100.0;
        double vr = (mvMl * paco2) / (predMvMl * 37.5);

        return Math.round(vr * 100.0) / 100.0;
    }

    /**
     * Evaluate Rapid Shallow Breathing Index (RSBI) for extubation readiness.
     * Formula: RSBI = Spontaneous RR / Spontaneous Vt (L)
     */
    public WeaningReadinessResult evaluateWeaningReadiness(double spontaneousRr, double spontaneousVtMl) {
        if (spontaneousRr <= 0 || spontaneousVtMl <= 0) {
            return new WeaningReadinessResult(0, false, "Patient not on spontaneous breathing mode.",
                    0, 0, "Initiate CPAP/PSV trial when clinical stability achieved.");
        }

        double vtLiters = spontaneousVtMl / 1000.0;
        int rsbi = (int) Math.round(spontaneousRr / vtLiters);
        boolean isFavorable = rsbi < 105;

        String interp = isFavorable
                ? "Favorable weaning index (RSBI < 105). High likelihood of successful Spontaneous Breathing Trial (SBT)."
                : "Unfavorable weaning index (RSBI >= 105). Rapid shallow breathing pattern detected.";

        String rec = isFavorable
                ? "Proceed with 30-120 minute SBT and assess cuff leak test and airway protection."
                : "Optimize pulmonary mechanics and treat reversible causes before re-attempting SBT.";

        return new WeaningReadinessResult(rsbi, isFavorable, interp, spontaneousVtMl, spontaneousRr, rec);
    }

    /**
     * Evaluate Berlin ARDS Staging.
     */
    public ArdsClassificationResult classifyBerlinArds(double pao2, double fio2, double peep,
                                                       boolean bilateralInfiltrates, boolean nonCardiogenic) {
        if (fio2 <= 0.0 || pao2 <= 0.0) {
            throw new IllegalArgumentException("PaO2 and FiO2 must be positive numbers.");
        }

        double pfRatio = Math.round((pao2 / fio2) * 10.0) / 10.0;
        boolean meetsPeep = peep >= 5.0;

        ArdsSeverity severity;
        double mortalityRisk;
        List<String> escalations = new ArrayList<>();

        if (bilateralInfiltrates && nonCardiogenic && meetsPeep) {
            if (pfRatio <= 100.0) {
                severity = ArdsSeverity.SEVERE_ARDS;
                mortalityRisk = 45.0;
                escalations.add("Initiate PROSEVA Prone Positioning Protocol (>= 16h/session)");
                escalations.add("Continuous Neuromuscular Blockade Infusion (Cisatracurium 48h)");
                escalations.add("Inhaled Pulmonary Vasodilators (Epoprostenol / Nitric Oxide)");
                escalations.add("VV-ECMO Cannulation Team Evaluation (CESAR/EOLIA criteria)");
            } else if (pfRatio <= 200.0) {
                severity = ArdsSeverity.MODERATE_ARDS;
                mortalityRisk = 32.0;
                escalations.add("Apply Higher-PEEP / Lower-FiO2 ARDSNet titration table");
                escalations.add("Maintain strict lung protection: Vt 6 mL/kg PBW, ΔP < 14 cmH2O");
                escalations.add("Screen for Prone Positioning if P/F remains < 150 despite PEEP optimization");
            } else if (pfRatio <= 300.0) {
                severity = ArdsSeverity.MILD_ARDS;
                mortalityRisk = 27.0;
                escalations.add("Lung-protective ventilation (6 mL/kg PBW)");
                escalations.add("Conservative fluid management strategy (FACTT trial protocol)");
            } else {
                severity = ArdsSeverity.AT_RISK_LUNG_INJURY;
                mortalityRisk = 12.0;
                escalations.add("Monitor for progression of hypoxemia");
            }
        } else {
            severity = pfRatio > 300.0 ? ArdsSeverity.WEANING_CANDIDATE : ArdsSeverity.AT_RISK_LUNG_INJURY;
            mortalityRisk = 8.0;
            escalations.add("Routine ICU monitoring");
        }

        return new ArdsClassificationResult(pfRatio, peep, meetsPeep, severity, mortalityRisk, escalations);
    }

    /**
     * Run full assessment on a request.
     */
    public PulmonaryAssessmentResponse processAssessment(PulmonaryAssessmentRequest request) {
        double pbw = calculatePredictedBodyWeight(request.getHeightCm(), request.getSex());
        double currentVtPerKg = Math.round((request.getMeasuredVtMl() / pbw) * 10.0) / 10.0;
        double target4 = Math.round(pbw * 4.0);
        double target6 = Math.round(pbw * 6.0);
        double target8 = Math.round(pbw * 8.0);

        MechanicalPowerResult mpResult = evaluateMechanicalPower(
                request.getMeasuredRr(),
                request.getMeasuredVtMl(),
                request.getPeakInspiratoryPressure(),
                request.getPlateauPressure(),
                request.getSetPeep()
        );

        double mvLiters = (request.getMeasuredRr() * request.getMeasuredVtMl()) / 1000.0;
        double vr = calculateVentilatoryRatio(mvLiters, request.getPaco2(), pbw);

        ArdsClassificationResult ardsResult = classifyBerlinArds(
                request.getPao2(),
                request.getFio2(),
                request.getSetPeep(),
                request.isBilateralInfiltrates(),
                request.isNonCardiogenicEdema()
        );

        WeaningReadinessResult weaningResult = evaluateWeaningReadiness(
                request.getSpontaneousRr(),
                request.getSpontaneousVtMl()
        );

        List<String> alerts = new ArrayList<>();
        if (!mpResult.isDrivingPressureProtective()) {
            alerts.add("ALERT: Driving pressure (" + mpResult.getDrivingPressureCmH2O() + " cmH2O) exceeds target < 14 cmH2O");
        }
        if (request.getPlateauPressure() > 30.0) {
            alerts.add("CRITICAL: Plateau pressure (" + request.getPlateauPressure() + " cmH2O) exceeds ARDSNet ceiling of 30 cmH2O");
        }
        if (mpResult.isCriticalViliRisk()) {
            alerts.add("CRITICAL: Gattinoni Mechanical Power (" + mpResult.getMechanicalPowerJoulesMin() + " J/min) indicates severe VILI risk");
        }
        if (vr > 1.5) {
            alerts.add("WARNING: Ventilatory Ratio (" + vr + ") indicates elevated pulmonary dead space fraction");
        }

        PulmonaryAssessmentResponse response = new PulmonaryAssessmentResponse();
        response.setPatientId(request.getPatientId());
        response.setPredictedBodyWeightKg(pbw);
        response.setCurrentVtMlPerKgPbw(currentVtPerKg);
        response.setTarget4mLkg(target4);
        response.setTarget6mLkg(target6);
        response.setTarget8mLkg(target8);
        response.setVentilatoryRatio(vr);
        response.setMechanicalPowerResult(mpResult);
        response.setArdsResult(ardsResult);
        response.setWeaningResult(weaningResult);
        response.setActiveClinicalAlerts(alerts);

        return response;
    }
}
