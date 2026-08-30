package com.medtrack.pulmonary.model;

import java.time.Instant;

/**
 * Real-time mechanical ventilator telemetry and blood gas snapshot.
 */
public class VentilatorReading {

    private String readingId;
    private String patientId;
    private VentilatorMode mode;
    private double setVtMl;
    private double measuredVtMl;
    private int setRr;
    private int measuredRr;
    private double fio2;
    private double setPeep;
    private double peakInspiratoryPressure;
    private double plateauPressure;
    private double autoPeep;
    private double inspiratoryTimeSeconds;
    private double pao2;
    private double paco2;
    private double arterialPh;
    private double spo2;
    private double meanAirwayPressure;
    private Instant timestamp;

    public VentilatorReading() {
        this.timestamp = Instant.now();
    }

    public String getReadingId() { return readingId; }
    public void setReadingId(String readingId) { this.readingId = readingId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public VentilatorMode getMode() { return mode; }
    public void setMode(VentilatorMode mode) { this.mode = mode; }

    public double getSetVtMl() { return setVtMl; }
    public void setSetVtMl(double setVtMl) { this.setVtMl = setVtMl; }

    public double getMeasuredVtMl() { return measuredVtMl; }
    public void setMeasuredVtMl(double measuredVtMl) { this.measuredVtMl = measuredVtMl; }

    public int getSetRr() { return setRr; }
    public void setSetRr(int setRr) { this.setRr = setRr; }

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

    public double getAutoPeep() { return autoPeep; }
    public void setAutoPeep(double autoPeep) { this.autoPeep = autoPeep; }

    public double getInspiratoryTimeSeconds() { return inspiratoryTimeSeconds; }
    public void setInspiratoryTimeSeconds(double inspiratoryTimeSeconds) { this.inspiratoryTimeSeconds = inspiratoryTimeSeconds; }

    public double getPao2() { return pao2; }
    public void setPao2(double pao2) { this.pao2 = pao2; }

    public double getPaco2() { return paco2; }
    public void setPaco2(double paco2) { this.paco2 = paco2; }

    public double getArterialPh() { return arterialPh; }
    public void setArterialPh(double arterialPh) { this.arterialPh = arterialPh; }

    public double getSpo2() { return spo2; }
    public void setSpo2(double spo2) { this.spo2 = spo2; }

    public double getMeanAirwayPressure() { return meanAirwayPressure; }
    public void setMeanAirwayPressure(double meanAirwayPressure) { this.meanAirwayPressure = meanAirwayPressure; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
