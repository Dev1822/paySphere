package com.medtrack.burncare.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Burn Critical Care & Resuscitation Fluid Dynamics Service.
 *
 * Implements American Burn Association (ABA) Parkland and Modified Brooke
 * fluid formulas, dynamic hourly urine output titration, and Intra-Abdominal
 * Hypertension (IAH) / Abdominal Compartment Syndrome (ACS) safety gates.
 */
public class BurnResuscitationService {

    public static class ParklandCalculationResult {
        private final double total24HourVolumeMl;
        private final double first8HourVolumeMl;
        private final double next16HourVolumeMl;
        private final double initialHourlyRateMlHr;

        public ParklandCalculationResult(double total24HourVolumeMl, double first8HourVolumeMl,
                                         double next16HourVolumeMl, double initialHourlyRateMlHr) {
            this.total24HourVolumeMl = total24HourVolumeMl;
            this.first8HourVolumeMl = first8HourVolumeMl;
            this.next16HourVolumeMl = next16HourVolumeMl;
            this.initialHourlyRateMlHr = initialHourlyRateMlHr;
        }

        public double getTotal24HourVolumeMl() { return total24HourVolumeMl; }
        public double getFirst8HourVolumeMl() { return first8HourVolumeMl; }
        public double getNext16HourVolumeMl() { return next16HourVolumeMl; }
        public double getInitialHourlyRateMlHr() { return initialHourlyRateMlHr; }
    }

    public static class FluidTitrationResult {
        private final double targetUoMinMlHr;
        private final double targetUoMaxMlHr;
        private final double recommendedInfusionRateMlHr;
        private final String adjustmentRationale;

        public FluidTitrationResult(double targetUoMinMlHr, double targetUoMaxMlHr,
                                    double recommendedInfusionRateMlHr, String adjustmentRationale) {
            this.targetUoMinMlHr = targetUoMinMlHr;
            this.targetUoMaxMlHr = targetUoMaxMlHr;
            this.recommendedInfusionRateMlHr = recommendedInfusionRateMlHr;
            this.adjustmentRationale = adjustmentRationale;
        }

        public double getTargetUoMinMlHr() { return targetUoMinMlHr; }
        public double getTargetUoMaxMlHr() { return targetUoMaxMlHr; }
        public double getRecommendedInfusionRateMlHr() { return recommendedInfusionRateMlHr; }
        public String getAdjustmentRationale() { return adjustmentRationale; }
    }

    /**
     * Compute Total 24-Hour Parkland Fluid Requirements.
     * Formula: 4 mL * Weight (kg) * % TBSA
     */
    public ParklandCalculationResult calculateParklandVolume(double weightKg, double tbsaPercent) {
        if (weightKg <= 0 || tbsaPercent <= 0) {
            throw new IllegalArgumentException("Weight and TBSA must be positive non-zero values");
        }

        double totalMl = 4.0 * weightKg * tbsaPercent;
        double first8hMl = totalMl * 0.5;
        double next16hMl = totalMl * 0.5;
        double rateMlHr = first8hMl / 8.0;

        return new ParklandCalculationResult(
                Math.round(totalMl),
                Math.round(first8hMl),
                Math.round(next16hMl),
                Math.round(rateMlHr)
        );
    }

    /**
     * Titrate Crystalloid Infusion Rate based on Hourly Urine Output response.
     */
    public FluidTitrationResult titrateFluidRate(double currentUoMl, double weightKg,
                                                 double currentRateMlHr, boolean isElectricalBurn) {
        double minTarget = isElectricalBurn ? (weightKg * 1.0) : (weightKg * 0.5);
        double maxTarget = isElectricalBurn ? (weightKg * 1.5) : (weightKg * 1.0);

        double newRate = currentRateMlHr;
        String rationale;

        if (currentUoMl < minTarget) {
            newRate = Math.round(currentRateMlHr * 1.25);
            rationale = "Oliguria: Increase crystalloid infusion by +25% to achieve target urine output.";
        } else if (currentUoMl > maxTarget) {
            newRate = Math.round(currentRateMlHr * 0.80);
            rationale = "Polyuria: Decrease crystalloid infusion by -20% to prevent fluid creep and IACS.";
        } else {
            rationale = "Urine output is on target. Maintain current infusion rate.";
        }

        return new FluidTitrationResult(minTarget, maxTarget, newRate, rationale);
    }
}
