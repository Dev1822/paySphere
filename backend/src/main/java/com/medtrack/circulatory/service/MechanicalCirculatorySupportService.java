package com.medtrack.circulatory.service;

import com.medtrack.circulatory.dto.*;
import com.medtrack.circulatory.model.McsDeviceType;
import com.medtrack.circulatory.model.ScaiShockStage;
import java.util.ArrayList;
import java.util.List;

/**
 * Enterprise Mechanical Circulatory Support (MCS) & Impella/LVAD Hemodynamics Service.
 *
 * Implements clinical algorithms for:
 * 1. Cardiac Power Output (CPO = MAP * CO / 451) with 0.60 W shock threshold.
 * 2. Pulmonary Artery Pulsatility Index (PAPi = [PASP - PADP] / CVP) for RV failure detection.
 * 3. Impella suction event and microaxial shear hemolysis risk surveillance.
 * 4. SCAI Cardiogenic Shock stage progression.
 */
public class MechanicalCirculatorySupportService {

    /**
     * Compute Cardiac Power Output (CPO).
     * Formula: CPO = (MAP * CO) / 451
     */
    public CardiacPowerOutputResult calculateCardiacPowerOutput(double meanArterialPressure, double cardiacOutputTotal) {
        if (meanArterialPressure <= 0.0 || cardiacOutputTotal <= 0.0) {
            throw new IllegalArgumentException("MAP and Cardiac Output must be positive non-zero values.");
        }

        double cpo = Math.round(((meanArterialPressure * cardiacOutputTotal) / 451.0) * 100.0) / 100.0;
        boolean isSevereShock = cpo < 0.60;
        boolean isAdequateReserve = cpo >= 0.80;

        String interpretation = isSevereShock
                ? "Severely depressed cardiac power output (< 0.60 W). High risk of uncompensated cardiogenic shock mortality."
                : isAdequateReserve
                ? "Adequate native cardiac power reserve (>= 0.80 W)."
                : "Borderline cardiac reserve (0.60 - 0.79 W).";

        return new CardiacPowerOutputResult(cpo, isSevereShock, isAdequateReserve, interpretation);
    }

    /**
     * Compute Pulmonary Artery Pulsatility Index (PAPi).
     * Formula: PAPi = (PASP - PADP) / CVP
     */
    public PapiEvaluationResult calculatePapi(double pasp, double padp, double cvp) {
        if (cvp <= 0.0) {
            throw new IllegalArgumentException("Central venous pressure must be a positive value.");
        }

        double pulsePressure = pasp - padp;
        if (pulsePressure <= 0.0) {
            throw new IllegalArgumentException("PASP must exceed PADP.");
        }

        double papi = Math.round((pulsePressure / cvp) * 100.0) / 100.0;
        boolean isRvFailure = papi < 1.0;
        boolean isBorderline = papi >= 1.0 && papi < 1.8;

        String interpretation = isRvFailure
                ? "Severe right ventricular failure risk (PAPi < 1.0). High probability of needing RV inotrope or Impella RP."
                : isBorderline
                ? "Borderline RV performance (PAPi 1.0 - 1.79)."
                : "Normal RV contractility (PAPi >= 1.8).";

        return new PapiEvaluationResult(papi, pulsePressure, isRvFailure, isBorderline, interpretation);
    }

    /**
     * Evaluate Suction Event and Hemolysis Risk.
     */
    public SuctionRiskResult evaluateSuctionAndHemolysis(double motorCurrentMa, double pfHbMgDl,
                                                         double ldhUnits, double antiXa) {
        boolean isSuction = motorCurrentMa >= 850.0;
        boolean isPfHbElevated = pfHbMgDl >= 40.0;

        String riskTier = isPfHbElevated || ldhUnits >= 500.0 ? "HIGH_HEMOLYSIS_RISK"
                : pfHbMgDl >= 25.0 ? "BORDERLINE_HEMOLYSIS"
                : "LOW_HEMOLYSIS_RISK";

        List<String> recommendations = new ArrayList<>();
        if (isSuction) {
            recommendations.add("Reduce Impella P-level immediately to break endocardial suction.");
            recommendations.add("Administer 250-500 mL IV crystalloid volume challenge.");
            recommendations.add("Perform bedside echo to evaluate cannula positioning.");
        }
        if (isPfHbElevated) {
            recommendations.add("Evaluate for cannula malposition or aortic valve impingement.");
            recommendations.add("Optimize purge solution heparin / bivalirudin concentration.");
        }
        if (antiXa < 0.30) {
            recommendations.add("Anticoagulation subtherapeutic (Anti-Xa < 0.30 IU/mL). Increase purge heparin.");
        }

        return new SuctionRiskResult(isSuction, motorCurrentMa, pfHbMgDl, riskTier, recommendations);
    }

    /**
     * Process full circulatory assessment.
     */
    public CirculatoryAssessmentResponse processAssessment(CirculatoryAssessmentRequest req) {
        CardiacPowerOutputResult cpoResult = calculateCardiacPowerOutput(
                req.getMeanArterialPressure(),
                req.getCardiacOutputTotal()
        );

        PapiEvaluationResult papiResult = calculatePapi(
                req.getPulmonaryArterySystolic(),
                req.getPulmonaryArteryDiastolic(),
                req.getCentralVenousPressure()
        );

        SuctionRiskResult suctionResult = evaluateSuctionAndHemolysis(
                req.getMotorCurrentMilliamps(),
                req.getPlasmaFreeHbMgDl(),
                req.getLdhUnitsPerLiter(),
                req.getAntiXaUnitsPerMl()
        );

        List<String> alerts = new ArrayList<>();
        if (cpoResult.isSevereShock()) {
            alerts.add("CRITICAL: Depressed CPO (" + cpoResult.getCardiacPowerOutputWatts() + " W) indicates profound cardiogenic shock");
        }
        if (papiResult.isRvFailureRisk()) {
            alerts.add("CRITICAL: Low PAPi (" + papiResult.getPulmonaryArteryPulsatilityIndex() + ") indicates high risk of acute RV failure");
        }
        if (suctionResult.isSuctionDetected()) {
            alerts.add("ALERT: Impella suction event detected (Motor current " + req.getMotorCurrentMilliamps() + " mA)");
        }

        ScaiShockStage stage = cpoResult.isSevereShock() && papiResult.isRvFailureRisk()
                ? ScaiShockStage.STAGE_E_EXTREMIS
                : cpoResult.isSevereShock()
                ? ScaiShockStage.STAGE_D_DETERIORATING
                : cpoResult.isAdequateReserve()
                ? ScaiShockStage.WEANING_TRIAL_CANDIDATE
                : ScaiShockStage.STAGE_C_CLASSIC;

        CirculatoryAssessmentResponse resp = new CirculatoryAssessmentResponse();
        resp.setPatientId(req.getPatientId());
        resp.setDeviceType(req.getDeviceType() != null ? req.getDeviceType() : McsDeviceType.IMPELLA_5_5);
        resp.setScaiStage(stage);
        resp.setCpoResult(cpoResult);
        resp.setPapiResult(papiResult);
        resp.setSuctionResult(suctionResult);
        resp.setActiveClinicalAlerts(alerts);

        return resp;
    }
}
