package com.medtrack.nicu.dto;

public class NeonatalAssessmentRequest {
    private String patientId;
    private double gestationalAgeWeeks;
    private double birthWeightGrams;
    private double preDuctalSpO2;
    private double postDuctalSpO2;
    private double airwayMapCmH2O;
    private double fio2Fraction;
    private double paO2MmHg;
    private double plateletsK;
    private double dopamineMcgKgMin;
    private double dobutamineMcgKgMin;
    private double epinephrineMcgKgMin;
    private double norepinephrineMcgKgMin;
    private double milrinoneMcgKgMin;
    private double vasopressinUnitsKgMin;
    private double coreTempC;
    private String coolingPhase;
    private double coolingElapsedHours;
    private double rewarmingRatePerHour;
    private String aEEGPattern;

    public NeonatalAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public double getGestationalAgeWeeks() { return gestationalAgeWeeks; }
    public void setGestationalAgeWeeks(double gestationalAgeWeeks) { this.gestationalAgeWeeks = gestationalAgeWeeks; }

    public double getBirthWeightGrams() { return birthWeightGrams; }
    public void setBirthWeightGrams(double birthWeightGrams) { this.birthWeightGrams = birthWeightGrams; }

    public double getPreDuctalSpO2() { return preDuctalSpO2; }
    public void setPreDuctalSpO2(double preDuctalSpO2) { this.preDuctalSpO2 = preDuctalSpO2; }

    public double getPostDuctalSpO2() { return postDuctalSpO2; }
    public void setPostDuctalSpO2(double postDuctalSpO2) { this.postDuctalSpO2 = postDuctalSpO2; }

    public double getAirwayMapCmH2O() { return airwayMapCmH2O; }
    public void setAirwayMapCmH2O(double airwayMapCmH2O) { this.airwayMapCmH2O = airwayMapCmH2O; }

    public double getFio2Fraction() { return fio2Fraction; }
    public void setFio2Fraction(double fio2Fraction) { this.fio2Fraction = fio2Fraction; }

    public double getPaO2MmHg() { return paO2MmHg; }
    public void setPaO2MmHg(double paO2MmHg) { this.paO2MmHg = paO2MmHg; }

    public double getPlateletsK() { return plateletsK; }
    public void setPlateletsK(double plateletsK) { this.plateletsK = plateletsK; }

    public double getDopamineMcgKgMin() { return dopamineMcgKgMin; }
    public void setDopamineMcgKgMin(double dopamineMcgKgMin) { this.dopamineMcgKgMin = dopamineMcgKgMin; }

    public double getDobutamineMcgKgMin() { return dobutamineMcgKgMin; }
    public void setDobutamineMcgKgMin(double dobutamineMcgKgMin) { this.dobutamineMcgKgMin = dobutamineMcgKgMin; }

    public double getEpinephrineMcgKgMin() { return epinephrineMcgKgMin; }
    public void setEpinephrineMcgKgMin(double epinephrineMcgKgMin) { this.epinephrineMcgKgMin = epinephrineMcgKgMin; }

    public double getNorepinephrineMcgKgMin() { return norepinephrineMcgKgMin; }
    public void setNorepinephrineMcgKgMin(double norepinephrineMcgKgMin) { this.norepinephrineMcgKgMin = norepinephrineMcgKgMin; }

    public double getMilrinoneMcgKgMin() { return milrinoneMcgKgMin; }
    public void setMilrinoneMcgKgMin(double milrinoneMcgKgMin) { this.milrinoneMcgKgMin = milrinoneMcgKgMin; }

    public double getVasopressinUnitsKgMin() { return vasopressinUnitsKgMin; }
    public void setVasopressinUnitsKgMin(double vasopressinUnitsKgMin) { this.vasopressinUnitsKgMin = vasopressinUnitsKgMin; }

    public double getCoreTempC() { return coreTempC; }
    public void setCoreTempC(double coreTempC) { this.coreTempC = coreTempC; }

    public String getCoolingPhase() { return coolingPhase; }
    public void setCoolingPhase(String coolingPhase) { this.coolingPhase = coolingPhase; }

    public double getCoolingElapsedHours() { return coolingElapsedHours; }
    public void setCoolingElapsedHours(double coolingElapsedHours) { this.coolingElapsedHours = coolingElapsedHours; }

    public double getRewarmingRatePerHour() { return rewarmingRatePerHour; }
    public void setRewarmingRatePerHour(double rewarmingRatePerHour) { this.rewarmingRatePerHour = rewarmingRatePerHour; }

    public String getAEEGPattern() { return aEEGPattern; }
    public void setAEEGPattern(String aEEGPattern) { this.aEEGPattern = aEEGPattern; }
}
