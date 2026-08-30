package com.medtrack.nicu.service;

import com.medtrack.nicu.dto.HypothermiaProtocolStatus;
import com.medtrack.nicu.dto.NeonatalAssessmentRequest;
import com.medtrack.nicu.dto.NeonatalAssessmentResponse;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Enterprise Neonatal Intensive Care Unit (NICU) Decision Support Service.
 *
 * Implements clinical algorithms for:
 * - Neonatal Sequential Organ Failure Assessment (nSOFA)
 * - Oxygenation Index (OI) calculation and PPHN / ECMO thresholding
 * - Pre-to-Post Ductal SpO2 Shunt Delta evaluation
 * - Vasoactive-Inotropic Score (VIS)
 * - 72-Hour Therapeutic Hypothermia Protocol Compliance & Rewarming Rate Sentry
 */
public class NeonatalIcuService {

    /**
     * Compute Oxygenation Index (OI).
     * Formula: OI = (MAP_airway * FiO2_pct) / PaO2_mmHg
     */
    public double calculateOxygenationIndex(double airwayMapCmH2O, double fio2Fraction, double paO2MmHg) {
        if (paO2MmHg <= 0) {
            throw new IllegalArgumentException("PaO2 must be greater than zero");
        }
        double fio2Pct = fio2Fraction <= 1.0 ? fio2Fraction * 100.0 : fio2Fraction;
        return Math.round(((airwayMapCmH2O * fio2Pct) / paO2MmHg) * 10.0) / 10.0;
    }

    /**
     * Compute Neonatal Vasoactive-Inotropic Score (VIS).
     */
    public double calculateNeonatalVIS(double dopamine, double dobutamine, double epinephrine,
                                     double norepinephrine, double milrinone, double vasopressin) {
        double vis = dopamine + dobutamine + (100.0 * epinephrine) + (100.0 * norepinephrine) +
                     (10.0 * milrinone) + (10000.0 * vasopressin);
        return Math.round(vis * 100.0) / 100.0;
    }

    /**
     * Compute nSOFA Organ Failure score (0 - 9).
     */
    public int calculateNSOFA(double plateletsK, double sfRatio, double visScore) {
        int plateletsScore = 0;
        if (plateletsK < 50) plateletsScore = 3;
        else if (plateletsK < 100) plateletsScore = 2;
        else if (plateletsK < 150) plateletsScore = 1;

        int respScore = 0;
        if (sfRatio < 150) respScore = 3;
        else if (sfRatio < 200) respScore = 2;
        else if (sfRatio < 300) respScore = 1;

        int cvScore = 0;
        if (visScore >= 15.0) cvScore = 3;
        else if (visScore >= 5.0) cvScore = 2;
        else if (visScore > 0.0) cvScore = 1;

        return plateletsScore + respScore + cvScore;
    }

    /**
     * Comprehensive clinical assessment engine.
     */
    public NeonatalAssessmentResponse evaluatePatient(NeonatalAssessmentRequest req) {
        NeonatalAssessmentResponse res = new NeonatalAssessmentResponse();
        res.setPatientId(req.getPatientId());
        res.setEvaluatedAt(Instant.now());

        List<String> alerts = new ArrayList<>();
        List<String> interventions = new ArrayList<>();

        // 1. Oxygenation Index & PPHN
        double oi = calculateOxygenationIndex(req.getAirwayMapCmH2O(), req.getFio2Fraction(), req.getPaO2MmHg());
        res.setOxygenationIndex(oi);

        if (oi >= 40.0) {
            res.setOxygenationInterpretation("Refractory Hypoxemic Respiratory Failure (Severe PPHN/MAS). ECMO Criteria Met.");
            res.setEcmoCandidate(true);
            res.setInoRecommended(true);
            alerts.add("CRITICAL: Oxygenation Index " + oi + " >= 40. Immediate Neonatal ECMO Cannulation Evaluation.");
            interventions.add("Initiate or escalate Inhaled Nitric Oxide to 20 ppm");
            interventions.add("Notify ECMO surgical team and perfusionist for bed-side cannulation");
        } else if (oi >= 25.0) {
            res.setOxygenationInterpretation("Severe Hypoxemic Respiratory Failure. iNO & HFOV optimization indicated.");
            res.setInoRecommended(true);
            res.setEcmoCandidate(false);
            alerts.add("HIGH: Severe Oxygenation Deficit (OI " + oi + "). Initiate Inhaled Nitric Oxide.");
            interventions.add("Initiate Inhaled Nitric Oxide (iNO) at 20 ppm");
            interventions.add("Optimize HFOV mean airway pressure and oscillatory amplitude");
        } else if (oi >= 15.0) {
            res.setOxygenationInterpretation("Moderate Hypoxemic Respiratory Impairment.");
            res.setInoRecommended(false);
            res.setEcmoCandidate(false);
        } else {
            res.setOxygenationInterpretation("Acceptable / Mild Oxygenation Reserve.");
            res.setInoRecommended(false);
            res.setEcmoCandidate(false);
        }

        // 2. Pre-to-Post Ductal Gradient
        double ductalDelta = Math.round((req.getPreDuctalSpO2() - req.getPostDuctalSpO2()) * 10.0) / 10.0;
        res.setDuctalDelta(ductalDelta);

        if (ductalDelta >= 10.0) {
            res.setDuctalShuntInterpretation("Severe Right-to-Left Ductal Shunting (Delta " + ductalDelta + "% >= 10%). High suspicion of PPHN or severe Coarctation.");
            alerts.add("WARNING: Pre/Post ductal SpO2 gradient " + ductalDelta + "% indicates significant R-to-L shunt.");
            interventions.add("Urgent Targeted Neonatal Echocardiography (TnECHO) to assess pulmonary artery pressures and PDA caliber");
        } else if (ductalDelta >= 5.0) {
            res.setDuctalShuntInterpretation("Moderate Right-to-Left Ductal Shunting (Delta " + ductalDelta + "%).");
        } else if (ductalDelta < -5.0) {
            res.setDuctalShuntInterpretation("Critical Reverse Differential Cyanosis (Post-ductal SpO2 > Pre-ductal). High suspicion of TGA with PDA.");
            alerts.add("CRITICAL: Reverse Differential Cyanosis. Evaluate for D-TGA with Coarctation/PPHN.");
        } else {
            res.setDuctalShuntInterpretation("Balanced or Minimal Ductal Gradient (< 5%).");
        }

        // 3. Vasoactive-Inotropic Score
        double vis = calculateNeonatalVIS(req.getDopamineMcgKgMin(), req.getDobutamineMcgKgMin(),
                                        req.getEpinephrineMcgKgMin(), req.getNorepinephrineMcgKgMin(),
                                        req.getMilrinoneMcgKgMin(), req.getVasopressinUnitsKgMin());
        res.setInotropicScoreVIS(vis);
        if (vis >= 20.0) res.setVisRiskTier("EXTREME_CARDIOVASCULAR_COLLAPSE (>= 20.0)");
        else if (vis >= 10.0) res.setVisRiskTier("HIGH_INOTROPIC_DEPENDENCE (10.0 - 19.9)");
        else if (vis >= 5.0) res.setVisRiskTier("MODERATE_SUPPORT (5.0 - 9.9)");
        else res.setVisRiskTier("LOW (< 5.0)");

        // 4. nSOFA Score
        double sfRatio = (req.getPreDuctalSpO2() / (req.getFio2Fraction() <= 1.0 ? req.getFio2Fraction() : req.getFio2Fraction() / 100.0));
        int nSofa = calculateNSOFA(req.getPlateletsK(), sfRatio, vis);
        res.setNSofaScore(nSofa);
        if (nSofa >= 6) res.setNSofaRiskTier("EXTREME_MORTALITY_RISK (nSOFA 6-9)");
        else if (nSofa >= 4) res.setNSofaRiskTier("HIGH_ORGAN_DYSFUNCTION (nSOFA 4-5)");
        else if (nSofa >= 2) res.setNSofaRiskTier("MODERATE_ORGAN_DYSFUNCTION (nSOFA 2-3)");
        else res.setNSofaRiskTier("LOW_ORGAN_DYSFUNCTION (nSOFA 0-1)");

        // 5. Therapeutic Hypothermia Safety Protocol
        boolean isCooling = req.getCoolingPhase() != null && !req.getCoolingPhase().equalsIgnoreCase("NONE");
        List<String> hypothermiaAlerts = new ArrayList<>();
        boolean targetMet = true;

        if (isCooling) {
            double targetTemp = req.getCoolingPhase().equalsIgnoreCase("REWARMING") ? 36.5 : 33.5;
            if (req.getCoolingPhase().equalsIgnoreCase("MAINTENANCE")) {
                if (req.getCoreTempC() < 33.0) {
                    hypothermiaAlerts.add("CRITICAL: Severe hypothermic overshoot (< 33.0°C). Adjust cooling mat.");
                    alerts.add("CRITICAL: Core temp " + req.getCoreTempC() + "°C < 33.0°C (Hypothermia Overshoot).");
                    targetMet = false;
                } else if (req.getCoreTempC() > 34.0) {
                    hypothermiaAlerts.add("WARNING: Core temp " + req.getCoreTempC() + "°C above target 33.5°C.");
                    targetMet = false;
                }
            } else if (req.getCoolingPhase().equalsIgnoreCase("REWARMING")) {
                if (req.getRewarmingRatePerHour() > 0.5) {
                    hypothermiaAlerts.add("CRITICAL: Rewarming velocity " + req.getRewarmingRatePerHour() + "°C/hr exceeds safety limit of 0.5°C/hr.");
                    alerts.add("CRITICAL: Excessive Rewarming Rate (" + req.getRewarmingRatePerHour() + "°C/hr > 0.5°C/hr). Slower rewarming required.");
                    targetMet = false;
                }
            }

            HypothermiaProtocolStatus hypo = new HypothermiaProtocolStatus(
                    true,
                    req.getCoolingPhase(),
                    req.getCoolingElapsedHours(),
                    targetTemp,
                    req.getCoreTempC(),
                    req.getRewarmingRatePerHour(),
                    req.getAEEGPattern() != null ? req.getAEEGPattern() : "CONTINUOUS_NORMAL_VOLTAGE",
                    targetMet,
                    hypothermiaAlerts
            );
            res.setHypothermiaStatus(hypo);
        }

        res.setActiveClinicalAlerts(alerts);
        res.setRecommendedInterventions(interventions);

        return res;
    }
}
