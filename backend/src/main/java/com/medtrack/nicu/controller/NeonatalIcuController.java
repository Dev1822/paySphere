package com.medtrack.nicu.controller;

import com.medtrack.nicu.dto.NeonatalAssessmentRequest;
import com.medtrack.nicu.dto.NeonatalAssessmentResponse;
import com.medtrack.nicu.service.NeonatalIcuService;

/**
 * REST controller for NICU clinical decision support, nSOFA, OI, and hypothermia tracking.
 */
public class NeonatalIcuController {

    private final NeonatalIcuService neonatalIcuService;

    public NeonatalIcuController() {
        this.neonatalIcuService = new NeonatalIcuService();
    }

    public NeonatalIcuController(NeonatalIcuService neonatalIcuService) {
        this.neonatalIcuService = neonatalIcuService;
    }

    /**
     * POST /api/nicu/patients/evaluate
     * Executes real-time nSOFA, OI, PDA shunt, and hypothermia safety evaluation.
     */
    public NeonatalAssessmentResponse evaluateNeonatalPatient(NeonatalAssessmentRequest request) {
        if (request == null || request.getPatientId() == null) {
            throw new IllegalArgumentException("Invalid assessment request or missing patient ID");
        }
        return neonatalIcuService.evaluatePatient(request);
    }

    /**
     * GET /api/nicu/patients/oxygenation-index
     */
    public double calculateOxygenationIndex(double mapAirway, double fio2, double paO2) {
        return neonatalIcuService.calculateOxygenationIndex(mapAirway, fio2, paO2);
    }

    /**
     * GET /api/nicu/patients/vis
     */
    public double calculateVIS(double dopamine, double dobutamine, double epinephrine,
                              double norepinephrine, double milrinone, double vasopressin) {
        return neonatalIcuService.calculateNeonatalVIS(dopamine, dobutamine, epinephrine, norepinephrine, milrinone, vasopressin);
    }
}
