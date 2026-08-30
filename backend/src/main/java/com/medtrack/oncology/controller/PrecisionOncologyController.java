package com.medtrack.oncology.controller;

import com.medtrack.oncology.dto.OncologyAssessmentRequest;
import com.medtrack.oncology.dto.OncologyAssessmentResponse;
import com.medtrack.oncology.service.PrecisionOncologyService;

/**
 * REST Controller for Precision Oncology, Bio-AI genomic scoring, and targeted therapy matching.
 */
public class PrecisionOncologyController {

    private final PrecisionOncologyService precisionOncologyService;

    public PrecisionOncologyController() {
        this.precisionOncologyService = new PrecisionOncologyService();
    }

    public PrecisionOncologyController(PrecisionOncologyService precisionOncologyService) {
        this.precisionOncologyService = precisionOncologyService;
    }

    /**
     * POST /api/oncology/patients/evaluate
     */
    public OncologyAssessmentResponse evaluatePatientGenomics(OncologyAssessmentRequest request) {
        if (request == null || request.getPatientId() == null) {
            throw new IllegalArgumentException("Invalid assessment request or missing patient ID");
        }
        return precisionOncologyService.evaluateMolecularProfile(request);
    }

    /**
     * GET /api/oncology/tmb/classify
     */
    public String classifyTMB(double tmbScore) {
        return precisionOncologyService.classifyTMB(tmbScore);
    }
}
