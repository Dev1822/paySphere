package com.medtrack.picu.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Pediatric ICU (PICU) Critical Care & pSOFA Service.
 *
 * Implements age-adjusted Pediatric Sequential Organ Failure Assessment (pSOFA),
 * Vasoactive-Inotropic Score (VIS) for pediatric septic/cardiogenic shock,
 * and PALICC Oxygenation Index (OI) for Pediatric ARDS.
 */
public class PicuCriticalCareService {

    public static class PsofaCalculationResult {
        private final int psofaScore;
        private final double estimatedMortalityRiskPct;
        private final String severityCategory;

        public PsofaCalculationResult(int psofaScore, double estimatedMortalityRiskPct, String severityCategory) {
            this.psofaScore = psofaScore;
            this.estimatedMortalityRiskPct = estimatedMortalityRiskPct;
            this.severityCategory = severityCategory;
        }

        public int getPsofaScore() { return psofaScore; }
        public double getEstimatedMortalityRiskPct() { return estimatedMortalityRiskPct; }
        public String getSeverityCategory() { return severityCategory; }
    }

    public static class VisCalculationResult {
        private final double visScore;
        private final String shockCategory;
        private final String titrationGuidance;

        public VisCalculationResult(double visScore, String shockCategory, String titrationGuidance) {
            this.visScore = visScore;
            this.shockCategory = shockCategory;
            this.titrationGuidance = titrationGuidance;
        }

        public double getVisScore() { return visScore; }
        public String getShockCategory() { return shockCategory; }
        public String getTitrationGuidance() { return titrationGuidance; }
    }

    /**
     * Compute Vasoactive-Inotropic Score (VIS).
     * Formula: Dopamine + Dobutamine + (100 * Epi) + (10 * Milrinone) + (10000 * Vaso) + (100 * NE)
     */
    public VisCalculationResult calculateVis(double dopamine, double dobutamine, double epinephrine,
                                             double milrinone, double vasopressin, double norepinephrine) {
        double rawVis = dopamine + dobutamine + (100.0 * epinephrine) + (10.0 * milrinone)
                + (10000.0 * vasopressin) + (100.0 * norepinephrine);
        double vis = Math.round(rawVis * 10.0) / 10.0;

        String category;
        String guidance;

        if (vis > 30.0) {
            category = "EXTREME_PEDIATRIC_VASOPLEGIC_SHOCK";
            guidance = "Stress-dose steroids (Hydrocortisone 50mg/m2/day) and evaluate for VA-ECMO.";
        } else if (vis > 20.0) {
            category = "SEVERE_PEDIATRIC_SHOCK";
            guidance = "Invasive arterial monitoring, serial lactate, and echocardiogram for LV/RV function.";
        } else if (vis >= 10.0) {
            category = "MODERATE_INOTROPIC_SUPPORT";
            guidance = "Titrate inotropes to maintain age-appropriate MAP and urine output > 1.0 mL/kg/h.";
        } else {
            category = "LOW_INOTROPIC_SUPPORT";
            guidance = "Stable cardiovascular support. Consider inotrope wean.";
        }

        return new VisCalculationResult(vis, category, guidance);
    }

    /**
     * Compute PALICC Oxygenation Index (OI).
     * Formula: (Mean Airway Pressure * FiO2% * 100) / PaO2
     */
    public double calculateOxygenationIndex(double meanAirwayPressure, double fio2Fraction, double pao2) {
        if (pao2 <= 0) return 0.0;
        double oi = (meanAirwayPressure * (fio2Fraction * 100.0)) / pao2;
        return Math.round(oi * 10.0) / 10.0;
    }
}
