package com.medtrack.circulatory.controller;

import com.medtrack.circulatory.dto.*;
import com.medtrack.circulatory.service.MechanicalCirculatorySupportService;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller for Mechanical Circulatory Support (MCS), Impella & LVAD Hemodynamics.
 */
public class MechanicalCirculatorySupportController {

    private final MechanicalCirculatorySupportService mcsService;

    public MechanicalCirculatorySupportController() {
        this.mcsService = new MechanicalCirculatorySupportService();
    }

    public MechanicalCirculatorySupportController(MechanicalCirculatorySupportService mcsService) {
        this.mcsService = mcsService;
    }

    /**
     * POST /api/circulatory/assessment
     * Perform comprehensive MCS hemodynamic and suction surveillance assessment.
     */
    public CirculatoryAssessmentResponse evaluateAssessment(CirculatoryAssessmentRequest request) {
        return mcsService.processAssessment(request);
    }

    /**
     * GET /api/circulatory/cpo
     * Compute Cardiac Power Output.
     */
    public CardiacPowerOutputResult getCardiacPowerOutput(double map, double co) {
        return mcsService.calculateCardiacPowerOutput(map, co);
    }

    /**
     * GET /api/circulatory/papi
     * Compute Pulmonary Artery Pulsatility Index for RV function.
     */
    public PapiEvaluationResult getPapi(double pasp, double padp, double cvp) {
        return mcsService.calculatePapi(pasp, padp, cvp);
    }

    /**
     * GET /api/circulatory/suction-risk
     * Evaluate motor current and hemolysis markers.
     */
    public SuctionRiskResult getSuctionRisk(double motorCurrentMa, double pfHbMgDl, double ldhUnits, double antiXa) {
        return mcsService.evaluateSuctionAndHemolysis(motorCurrentMa, pfHbMgDl, ldhUnits, antiXa);
    }
}
