package com.medtrack.pulmonary.controller;

import com.medtrack.pulmonary.dto.*;
import com.medtrack.pulmonary.service.PulmonaryARDSVentilationService;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller for Pulmonary Critical Care, ARDS & Mechanical Ventilation Decision Support.
 */
public class PulmonaryARDSVentilationController {

    private final PulmonaryARDSVentilationService ventilationService;

    public PulmonaryARDSVentilationController() {
        this.ventilationService = new PulmonaryARDSVentilationService();
    }

    public PulmonaryARDSVentilationController(PulmonaryARDSVentilationService ventilationService) {
        this.ventilationService = ventilationService;
    }

    /**
     * POST /api/pulmonary/assessment
     * Perform full pulmonary mechanics, ARDS staging, and lung protection evaluation.
     */
    public PulmonaryAssessmentResponse evaluateAssessment(PulmonaryAssessmentRequest request) {
        return ventilationService.processAssessment(request);
    }

    /**
     * GET /api/pulmonary/targets
     * Compute PBW and ARDSNet 4-8 mL/kg tidal volume targets.
     */
    public Map<String, Object> getLtvvTargets(double heightCm, String sex) {
        double pbw = ventilationService.calculatePredictedBodyWeight(heightCm, sex);
        Map<String, Object> response = new HashMap<>();
        response.put("heightCm", heightCm);
        response.put("sex", sex);
        response.put("predictedBodyWeightKg", pbw);
        response.put("target4mLkg", Math.round(pbw * 4.0));
        response.put("target6mLkg", Math.round(pbw * 6.0));
        response.put("target8mLkg", Math.round(pbw * 8.0));
        response.put("recommendedTidalVolumeRange", Math.round(pbw * 4.0) + " - " + Math.round(pbw * 8.0) + " mL");
        return response;
    }

    /**
     * GET /api/pulmonary/driving-pressure
     * Calculate driving pressure (Pplat - PEEP).
     */
    public Map<String, Object> getDrivingPressure(double plateauPressure, double peep) {
        double deltaP = ventilationService.calculateDrivingPressure(plateauPressure, peep);
        Map<String, Object> response = new HashMap<>();
        response.put("plateauPressure", plateauPressure);
        response.put("peep", peep);
        response.put("drivingPressure", deltaP);
        response.put("isProtective", deltaP < 14.0);
        response.put("target", "< 14 cmH2O");
        return response;
    }

    /**
     * GET /api/pulmonary/mechanical-power
     * Calculate Gattinoni Mechanical Power.
     */
    public MechanicalPowerResult getMechanicalPower(int rr, double vtMl, double pPeak, double pPlat, double peep) {
        return ventilationService.evaluateMechanicalPower(rr, vtMl, pPeak, pPlat, peep);
    }

    /**
     * GET /api/pulmonary/rsbi
     * Calculate Rapid Shallow Breathing Index for SBT.
     */
    public WeaningReadinessResult getRsbi(double spontaneousRr, double spontaneousVtMl) {
        return ventilationService.evaluateWeaningReadiness(spontaneousRr, spontaneousVtMl);
    }
}
