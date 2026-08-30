package com.medtrack.pulmonary.dto;

/**
 * Result of Gattinoni Mechanical Power of Ventilation calculation.
 */
public class MechanicalPowerResult {

    private double mechanicalPowerJoulesMin;
    private String riskCategory;
    private boolean isCriticalViliRisk;
    private double drivingPressureCmH2O;
    private boolean isDrivingPressureProtective;
    private double staticComplianceMlCmH2O;
    private String complianceInterpretation;
    private String recommendation;

    public MechanicalPowerResult() {}

    public MechanicalPowerResult(double mechanicalPowerJoulesMin, String riskCategory,
                                 boolean isCriticalViliRisk, double drivingPressureCmH2O,
                                 boolean isDrivingPressureProtective, double staticComplianceMlCmH2O,
                                 String complianceInterpretation, String recommendation) {
        this.mechanicalPowerJoulesMin = mechanicalPowerJoulesMin;
        this.riskCategory = riskCategory;
        this.isCriticalViliRisk = isCriticalViliRisk;
        this.drivingPressureCmH2O = drivingPressureCmH2O;
        this.isDrivingPressureProtective = isDrivingPressureProtective;
        this.staticComplianceMlCmH2O = staticComplianceMlCmH2O;
        this.complianceInterpretation = complianceInterpretation;
        this.recommendation = recommendation;
    }

    public double getMechanicalPowerJoulesMin() { return mechanicalPowerJoulesMin; }
    public void setMechanicalPowerJoulesMin(double mechanicalPowerJoulesMin) { this.mechanicalPowerJoulesMin = mechanicalPowerJoulesMin; }

    public String getRiskCategory() { return riskCategory; }
    public void setRiskCategory(String riskCategory) { this.riskCategory = riskCategory; }

    public boolean isCriticalViliRisk() { return isCriticalViliRisk; }
    public void setCriticalViliRisk(boolean criticalViliRisk) { isCriticalViliRisk = criticalViliRisk; }

    public double getDrivingPressureCmH2O() { return drivingPressureCmH2O; }
    public void setDrivingPressureCmH2O(double drivingPressureCmH2O) { this.drivingPressureCmH2O = drivingPressureCmH2O; }

    public boolean isDrivingPressureProtective() { return isDrivingPressureProtective; }
    public void setDrivingPressureProtective(boolean drivingPressureProtective) { isDrivingPressureProtective = drivingPressureProtective; }

    public double getStaticComplianceMlCmH2O() { return staticComplianceMlCmH2O; }
    public void setStaticComplianceMlCmH2O(double staticComplianceMlCmH2O) { this.staticComplianceMlCmH2O = staticComplianceMlCmH2O; }

    public String getComplianceInterpretation() { return complianceInterpretation; }
    public void setComplianceInterpretation(String complianceInterpretation) { this.complianceInterpretation = complianceInterpretation; }

    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
}
