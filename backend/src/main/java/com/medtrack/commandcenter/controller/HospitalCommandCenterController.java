package com.medtrack.commandcenter.controller;

import com.medtrack.commandcenter.dto.*;
import com.medtrack.commandcenter.service.HospitalCommandCenterService;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Controller for Hospital Command Center & Bio-AI Predictive Deterioration Hub.
 */
public class HospitalCommandCenterController {

    private final HospitalCommandCenterService commandCenterService;

    public HospitalCommandCenterController() {
        this.commandCenterService = new HospitalCommandCenterService();
    }

    public HospitalCommandCenterController(HospitalCommandCenterService commandCenterService) {
        this.commandCenterService = commandCenterService;
    }

    /**
     * POST /api/commandcenter/assessment
     * Perform comprehensive physiological deterioration and ICU escalation analysis.
     */
    public DeteriorationAssessmentResponse evaluateAssessment(DeteriorationAssessmentRequest request) {
        return commandCenterService.processAssessment(request);
    }

    /**
     * GET /api/commandcenter/news2
     * Compute NEWS2 early warning score.
     */
    public EarlyWarningScoreResult getNews2Score(double rr, double spO2, double fio2,
                                                 double sbp, double hr, int gcs, double tempC) {
        return commandCenterService.calculateNews2(rr, spO2, fio2, sbp, hr, gcs, tempC);
    }

    /**
     * GET /api/commandcenter/shock-index
     * Compute Shock Index and Modified Shock Index.
     */
    public Map<String, Object> getShockIndices(double hr, double sbp, double map) {
        double[] indices = commandCenterService.calculateShockIndices(hr, sbp, map);
        Map<String, Object> response = new HashMap<>();
        response.put("heartRate", hr);
        response.put("systolicBp", sbp);
        response.put("meanArterialPressure", map);
        response.put("shockIndex", indices[0]);
        response.put("modifiedShockIndex", indices[1]);
        response.put("isShockIndexCritical", indices[0] >= 0.9);
        return response;
    }

    /**
     * GET /api/commandcenter/step-down-readiness
     * Evaluate ICU/PCU de-escalation readiness.
     */
    public StepDownReadinessResult getStepDownReadiness(String vasopressor, double fio2,
                                                        double lactate, int news2, double urineOutput) {
        return commandCenterService.evaluateStepDownReadiness(vasopressor, fio2, lactate, news2, urineOutput);
    }
}
