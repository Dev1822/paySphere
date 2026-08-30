package com.medtrack.circulatory.dto;

import com.medtrack.circulatory.model.McsDeviceType;

/**
 * Request payload for mechanical circulatory support assessment.
 */
public class CirculatoryAssessmentRequest {

    private String patientId;
    private McsDeviceType deviceType;
    private double meanArterialPressure;
    private double cardiacOutputTotal;
    private double impellaFlowLitersMin;
    private double motorCurrentMilliamps;
    private double pulmonaryArterySystolic;
    private double pulmonaryArteryDiastolic;
    private double centralVenousPressure;
    private double plasmaFreeHbMgDl;
    private double ldhUnitsPerLiter;
    private double antiXaUnitsPerMl;

    public CirculatoryAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public McsDeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(McsDeviceType deviceType) { this.deviceType = deviceType; }

    public double getMeanArterialPressure() { return meanArterialPressure; }
    public void setMeanArterialPressure(double meanArterialPressure) { this.meanArterialPressure = meanArterialPressure; }

    public double getCardiacOutputTotal() { return cardiacOutputTotal; }
    public void setCardiacOutputTotal(double cardiacOutputTotal) { this.cardiacOutputTotal = cardiacOutputTotal; }

    public double getImpellaFlowLitersMin() { return impellaFlowLitersMin; }
    public void setImpellaFlowLitersMin(double impellaFlowLitersMin) { this.impellaFlowLitersMin = impellaFlowLitersMin; }

    public double getMotorCurrentMilliamps() { return motorCurrentMilliamps; }
    public void setMotorCurrentMilliamps(double motorCurrentMilliamps) { this.motorCurrentMilliamps = motorCurrentMilliamps; }

    public double getPulmonaryArterySystolic() { return pulmonaryArterySystolic; }
    public void setPulmonaryArterySystolic(double pulmonaryArterySystolic) { this.pulmonaryArterySystolic = pulmonaryArterySystolic; }

    public double getPulmonaryArteryDiastolic() { return pulmonaryArteryDiastolic; }
    public void setPulmonaryArteryDiastolic(double pulmonaryArteryDiastolic) { this.pulmonaryArteryDiastolic = pulmonaryArteryDiastolic; }

    public double getCentralVenousPressure() { return centralVenousPressure; }
    public void setCentralVenousPressure(double centralVenousPressure) { this.centralVenousPressure = centralVenousPressure; }

    public double getPlasmaFreeHbMgDl() { return plasmaFreeHbMgDl; }
    public void setPlasmaFreeHbMgDl(double plasmaFreeHbMgDl) { this.plasmaFreeHbMgDl = plasmaFreeHbMgDl; }

    public double getLdhUnitsPerLiter() { return ldhUnitsPerLiter; }
    public void setLdhUnitsPerLiter(double ldhUnitsPerLiter) { this.ldhUnitsPerLiter = ldhUnitsPerLiter; }

    public double getAntiXaUnitsPerMl() { return antiXaUnitsPerMl; }
    public void setAntiXaUnitsPerMl(double antiXaUnitsPerMl) { this.antiXaUnitsPerMl = antiXaUnitsPerMl; }
}
