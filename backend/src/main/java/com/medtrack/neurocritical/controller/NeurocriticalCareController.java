package com.medtrack.neurocritical.controller;

import com.medtrack.neurocritical.dto.NeuromonitoringAssessmentRequest;
import com.medtrack.neurocritical.dto.NeuromonitoringAssessmentResponse;
import com.medtrack.neurocritical.service.NeurocriticalCareService;

/**
 * REST Controller for Neurocritical Care decision support, ICP/CPP calculations, and SIBICC tiering.
 */
public class NeurocriticalCareController {

    private final NeurocriticalCareService neurocriticalCareService;

    public NeurocriticalCareController() {
        this.neurocriticalCareService = new NeurocriticalCareService();
    }

    public NeurocriticalCareController(NeurocriticalCareService neurocriticalCareService) {
        this.neurocriticalCareService = neurocriticalCareService;
    }

    /**
     * POST /api/neurocritical/patients/evaluate
     */
    public NeuromonitoringAssessmentResponse evaluateNeuromonitoring(NeuromonitoringAssessmentRequest request) {
        if (request == null || request.getPatientId() == null) {
            throw new IllegalArgumentException("Invalid assessment request or missing patient ID");
        }
        return neurocriticalCareService.evaluateNeuromonitoring(request);
    }

    /**
     * GET /api/neurocritical/cpp
     */
    public double calculateCPP(double map, double icp) {
        return neurocriticalCareService.calculateCPP(map, icp);
    }
}
