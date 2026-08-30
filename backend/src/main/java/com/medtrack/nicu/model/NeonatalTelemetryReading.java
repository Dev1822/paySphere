package com.medtrack.nicu.model;

import java.time.Instant;

/**
 * High-frequency neonatal physiological and ventilator telemetry reading.
 */
public class NeonatalTelemetryReading {
    private Instant timestamp;
    private int heartRate;
    private int respRate;
    private double preDuctalSpO2;
    private double postDuctalSpO2;
    private double ductalDelta;
    private double systolicBp;
    private double diastolicBp;
    private double map;
    private double coreTempC;
    private double skinTempC;
    private double etCO2;
    private double paO2;
    private double paCO2;
    private double ph;
    private double baseExcess;
    private double lactateMmolL;
    private double plateletsK;
    private double urineOutputMlKgHr;

    public NeonatalTelemetryReading() {
        this.timestamp = Instant.now();
    }

    public NeonatalTelemetryReading(Instant timestamp, int heartRate, int respRate, double preDuctalSpO2,
                                  double postDuctalSpO2, double systolicBp, double diastolicBp, double map,
                                  double coreTempC, double skinTempC, double etCO2, double paO2, double paCO2,
                                  double ph, double baseExcess, double lactateMmolL, double plateletsK,
                                  double urineOutputMlKgHr) {
        this.timestamp = timestamp;
        this.heartRate = heartRate;
        this.respRate = respRate;
        this.preDuctalSpO2 = preDuctalSpO2;
        this.postDuctalSpO2 = postDuctalSpO2;
        this.ductalDelta = Math.round((preDuctalSpO2 - postDuctalSpO2) * 10.0) / 10.0;
        this.systolicBp = systolicBp;
        this.diastolicBp = diastolicBp;
        this.map = map;
        this.coreTempC = coreTempC;
        this.skinTempC = skinTempC;
        this.etCO2 = etCO2;
        this.paO2 = paO2;
        this.paCO2 = paCO2;
        this.ph = ph;
        this.baseExcess = baseExcess;
        this.lactateMmolL = lactateMmolL;
        this.plateletsK = plateletsK;
        this.urineOutputMlKgHr = urineOutputMlKgHr;
    }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public int getHeartRate() { return heartRate; }
    public void setHeartRate(int heartRate) { this.heartRate = heartRate; }

    public int getRespRate() { return respRate; }
    public void setRespRate(int respRate) { this.respRate = respRate; }

    public double getPreDuctalSpO2() { return preDuctalSpO2; }
    public void setPreDuctalSpO2(double preDuctalSpO2) {
        this.preDuctalSpO2 = preDuctalSpO2;
        this.ductalDelta = Math.round((this.preDuctalSpO2 - this.postDuctalSpO2) * 10.0) / 10.0;
    }

    public double getPostDuctalSpO2() { return postDuctalSpO2; }
    public void setPostDuctalSpO2(double postDuctalSpO2) {
        this.postDuctalSpO2 = postDuctalSpO2;
        this.ductalDelta = Math.round((this.preDuctalSpO2 - this.postDuctalSpO2) * 10.0) / 10.0;
    }

    public double getDuctalDelta() { return ductalDelta; }

    public double getSystolicBp() { return systolicBp; }
    public void setSystolicBp(double systolicBp) { this.systolicBp = systolicBp; }

    public double getDiastolicBp() { return diastolicBp; }
    public void setDiastolicBp(double diastolicBp) { this.diastolicBp = diastolicBp; }

    public double getMap() { return map; }
    public void setMap(double map) { this.map = map; }

    public double getCoreTempC() { return coreTempC; }
    public void setCoreTempC(double coreTempC) { this.coreTempC = coreTempC; }

    public double getSkinTempC() { return skinTempC; }
    public void setSkinTempC(double skinTempC) { this.skinTempC = skinTempC; }

    public double getEtCO2() { return etCO2; }
    public void setEtCO2(double etCO2) { this.etCO2 = etCO2; }

    public double getPaO2() { return paO2; }
    public void setPaO2(double paO2) { this.paO2 = paO2; }

    public double getPaCO2() { return paCO2; }
    public void setPaCO2(double paCO2) { this.paCO2 = paCO2; }

    public double getPh() { return ph; }
    public void setPh(double ph) { this.ph = ph; }

    public double getBaseExcess() { return baseExcess; }
    public void setBaseExcess(double baseExcess) { this.baseExcess = baseExcess; }

    public double getLactateMmolL() { return lactateMmolL; }
    public void setLactateMmolL(double lactateMmolL) { this.lactateMmolL = lactateMmolL; }

    public double getPlateletsK() { return plateletsK; }
    public void setPlateletsK(double plateletsK) { this.plateletsK = plateletsK; }

    public double getUrineOutputMlKgHr() { return urineOutputMlKgHr; }
    public void setUrineOutputMlKgHr(double urineOutputMlKgHr) { this.urineOutputMlKgHr = urineOutputMlKgHr; }
}
