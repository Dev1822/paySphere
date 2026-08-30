package com.medtrack.commandcenter.dto;

import com.medtrack.commandcenter.model.HospitalUnit;

/**
 * Request DTO for continuous inpatient deterioration risk assessment.
 */
public class DeteriorationAssessmentRequest {

    private String patientId;
    private HospitalUnit unit;
    private double heartRate;
    private double systolicBp;
    private double diastolicBp;
    private double meanArterialPressure;
    private double respRate;
    private double spO2;
    private double fio2;
    private double tempC;
    private int gcsScore;
    private double serumLactate;
    private double wbcCount;
    private double serumCreatinine;
    private double baselineCreatinine;
    private double urineOutputMlPerHour;
    private String activeVasopressor;

    public DeteriorationAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public HospitalUnit getUnit() { return unit; }
    public void setUnit(HospitalUnit unit) { this.unit = unit; }

    public double getHeartRate() { return heartRate; }
    public void setHeartRate(double heartRate) { this.heartRate = heartRate; }

    public double getSystolicBp() { return systolicBp; }
    public void setSystolicBp(double systolicBp) { this.systolicBp = systolicBp; }

    public double getDiastolicBp() { return diastolicBp; }
    public void setDiastolicBp(double diastolicBp) { this.diastolicBp = diastolicBp; }

    public double getMeanArterialPressure() { return meanArterialPressure; }
    public void setMeanArterialPressure(double meanArterialPressure) { this.meanArterialPressure = meanArterialPressure; }

    public double getRespRate() { return respRate; }
    public void setRespRate(double respRate) { this.respRate = respRate; }

    public double getSpO2() { return spO2; }
    public void setSpO2(double spO2) { this.spO2 = spO2; }

    public double getFio2() { return fio2; }
    public void setFio2(double fio2) { this.fio2 = fio2; }

    public double getTempC() { return tempC; }
    public void setTempC(double tempC) { this.tempC = tempC; }

    public int getGcsScore() { return gcsScore; }
    public void setGcsScore(int gcsScore) { this.gcsScore = gcsScore; }

    public double getSerumLactate() { return serumLactate; }
    public void setSerumLactate(double serumLactate) { this.serumLactate = serumLactate; }

    public double getWbcCount() { return wbcCount; }
    public void setWbcCount(double wbcCount) { this.wbcCount = wbcCount; }

    public double getSerumCreatinine() { return serumCreatinine; }
    public void setSerumCreatinine(double serumCreatinine) { this.serumCreatinine = serumCreatinine; }

    public double getBaselineCreatinine() { return baselineCreatinine; }
    public void setBaselineCreatinine(double baselineCreatinine) { this.baselineCreatinine = baselineCreatinine; }

    public double getUrineOutputMlPerHour() { return urineOutputMlPerHour; }
    public void setUrineOutputMlPerHour(double urineOutputMlPerHour) { this.urineOutputMlPerHour = urineOutputMlPerHour; }

    public String getActiveVasopressor() { return activeVasopressor; }
    public void setActiveVasopressor(String activeVasopressor) { this.activeVasopressor = activeVasopressor; }
}
