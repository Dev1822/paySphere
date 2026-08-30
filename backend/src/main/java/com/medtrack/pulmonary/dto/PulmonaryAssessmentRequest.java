package com.medtrack.pulmonary.dto;

import com.medtrack.pulmonary.model.VentilatorMode;

/**
 * Request payload for pulmonary mechanics and ARDS clinical decision calculation.
 */
public class PulmonaryAssessmentRequest {

    private String patientId;
    private double heightCm;
    private String sex;
    private double actualWeightKg;
    private VentilatorMode mode;
    private double measuredVtMl;
    private int measuredRr;
    private double fio2;
    private double setPeep;
    private double peakInspiratoryPressure;
    private double plateauPressure;
    private double pao2;
    private double paco2;
    private double spontaneousRr;
    private double spontaneousVtMl;
    private boolean bilateralInfiltrates;
    private boolean nonCardiogenicEdema;

    public PulmonaryAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public double getHeightCm() { return heightCm; }
    public void setHeightCm(double heightCm) { this.heightCm = heightCm; }

    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }

    public double getActualWeightKg() { return actualWeightKg; }
    public void setActualWeightKg(double actualWeightKg) { this.actualWeightKg = actualWeightKg; }

    public VentilatorMode getMode() { return mode; }
    public void setMode(VentilatorMode mode) { this.mode = mode; }

    public double getMeasuredVtMl() { return measuredVtMl; }
    public void setMeasuredVtMl(double measuredVtMl) { this.measuredVtMl = measuredVtMl; }

    public int getMeasuredRr() { return measuredRr; }
    public void setMeasuredRr(int measuredRr) { this.measuredRr = measuredRr; }

    public double getFio2() { return fio2; }
    public void setFio2(double fio2) { this.fio2 = fio2; }

    public double getSetPeep() { return setPeep; }
    public void setSetPeep(double setPeep) { this.setPeep = setPeep; }

    public double getPeakInspiratoryPressure() { return peakInspiratoryPressure; }
    public void setPeakInspiratoryPressure(double peakInspiratoryPressure) { this.peakInspiratoryPressure = peakInspiratoryPressure; }

    public double getPlateauPressure() { return plateauPressure; }
    public void setPlateauPressure(double plateauPressure) { this.plateauPressure = plateauPressure; }

    public double getPao2() { return pao2; }
    public void setPao2(double pao2) { this.pao2 = pao2; }

    public double getPaco2() { return paco2; }
    public void setPaco2(double paco2) { this.paco2 = paco2; }

    public double getSpontaneousRr() { return spontaneousRr; }
    public void setSpontaneousRr(double spontaneousRr) { this.spontaneousRr = spontaneousRr; }

    public double getSpontaneousVtMl() { return spontaneousVtMl; }
    public void setSpontaneousVtMl(double spontaneousVtMl) { this.spontaneousVtMl = spontaneousVtMl; }

    public boolean isBilateralInfiltrates() { return bilateralInfiltrates; }
    public void setBilateralInfiltrates(boolean bilateralInfiltrates) { this.bilateralInfiltrates = bilateralInfiltrates; }

    public boolean isNonCardiogenicEdema() { return nonCardiogenicEdema; }
    public void setNonCardiogenicEdema(boolean nonCardiogenicEdema) { this.nonCardiogenicEdema = nonCardiogenicEdema; }
}
