package com.medtrack.nephrology.controller;

import com.medtrack.nephrology.dto.CrrtAssessmentRequest;
import com.medtrack.nephrology.dto.CrrtAssessmentResponse;
import com.medtrack.nephrology.service.NephrologyCrrtService;

/**
 * REST Controller for Nephrology CRRT decision support, KDIGO staging, and circuit clotting sentry.
 */
public class NephrologyCrrtController {

    private final NephrologyCrrtService nephrologyCrrtService;

    public NephrologyCrrtController() {
        this.nephrologyCrrtService = new NephrologyCrrtService();
    }

    public NephrologyCrrtController(NephrologyCrrtService nephrologyCrrtService) {
        this.nephrologyCrrtService = nephrologyCrrtService;
    }

    /**
     * POST /api/nephrology/crrt/evaluate
     */
    public CrrtAssessmentResponse evaluateCrrtSession(CrrtAssessmentRequest request) {
        if (request == null || request.getPatientId() == null) {
            throw new IllegalArgumentException("Invalid assessment request or missing patient ID");
        }
        return nephrologyCrrtService.evaluateCrrtSession(request);
    }

    /**
     * GET /api/nephrology/kdigo/stage
     */
    public int calculateKdigo(double baselineCreatinine, double currentCreatinine, double urineOutput, boolean onRRT) {
        return nephrologyCrrtService.calculateKdigoStage(baselineCreatinine, currentCreatinine, urineOutput, onRRT);
    }
}
