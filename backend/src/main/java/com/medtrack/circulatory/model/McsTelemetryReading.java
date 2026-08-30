package com.medtrack.circulatory.model;

import java.time.Instant;

/**
 * Mechanical Circulatory Support Telemetry snapshot.
 */
public class McsTelemetryReading {

    private String patientId;
    private McsDeviceType deviceType;
    private ScaiShockStage scaiStage;
    private String pLevel;
    private double impellaFlowLitersMin;
    private double motorCurrentMilliamps;
    private double purgePressureMmHg;
    private double purgeFlowMlPerHour;
    private double lvadSpeedRpm;
    private double lvadPowerWatts;
    private double lvadPulsatilityIndex;
    private double heartRate;
    private double systolicBp;
    private double diastolicBp;
    private double meanArterialPressure;
    private double cardiacOutputTotal;
    private double pulmonaryArterySystolic;
    private double pulmonaryArteryDiastolic;
    private double centralVenousPressure;
    private double pulmonaryCapillaryWedgePressure;
    private double serumLactate;
    private double plasmaFreeHbMgDl;
    private Instant recordedAt;

    public McsTelemetryReading() {
        this.recordedAt = Instant.now();
    }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public McsDeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(McsDeviceType deviceType) { this.deviceType = deviceType; }

    public ScaiShockStage getScaiStage() { return scaiStage; }
    public void setScaiStage(ScaiShockStage scaiStage) { this.scaiStage = scaiStage; }

    public String getPLevel() { return pLevel; }
    public void setPLevel(String pLevel) { this.pLevel = pLevel; }

    public double getImpellaFlowLitersMin() { return impellaFlowLitersMin; }
    public void setImpellaFlowLitersMin(double impellaFlowLitersMin) { this.impellaFlowLitersMin = impellaFlowLitersMin; }

    public double getMotorCurrentMilliamps() { return motorCurrentMilliamps; }
    public void setMotorCurrentMilliamps(double motorCurrentMilliamps) { this.motorCurrentMilliamps = motorCurrentMilliamps; }

    public double getPurgePressureMmHg() { return purgePressureMmHg; }
    public void setPurgePressureMmHg(double purgePressureMmHg) { this.purgePressureMmHg = purgePressureMmHg; }

    public double getPurgeFlowMlPerHour() { return purgeFlowMlPerHour; }
    public void setPurgeFlowMlPerHour(double purgeFlowMlPerHour) { this.purgeFlowMlPerHour = purgeFlowMlPerHour; }

    public double getLvadSpeedRpm() { return lvadSpeedRpm; }
    public void setLvadSpeedRpm(double lvadSpeedRpm) { this.lvadSpeedRpm = lvadSpeedRpm; }

    public double getLvadPowerWatts() { return lvadPowerWatts; }
    public void setLvadPowerWatts(double lvadPowerWatts) { this.lvadPowerWatts = lvadPowerWatts; }

    public double getLvadPulsatilityIndex() { return lvadPulsatilityIndex; }
    public void setLvadPulsatilityIndex(double lvadPulsatilityIndex) { this.lvadPulsatilityIndex = lvadPulsatilityIndex; }

    public double getHeartRate() { return heartRate; }
    public void setHeartRate(double heartRate) { this.heartRate = heartRate; }

    public double getSystolicBp() { return systolicBp; }
    public void setSystolicBp(double systolicBp) { this.systolicBp = systolicBp; }

    public double getDiastolicBp() { return diastolicBp; }
    public void setDiastolicBp(double diastolicBp) { this.diastolicBp = diastolicBp; }

    public double getMeanArterialPressure() { return meanArterialPressure; }
    public void setMeanArterialPressure(double meanArterialPressure) { this.meanArterialPressure = meanArterialPressure; }

    public double getCardiacOutputTotal() { return cardiacOutputTotal; }
    public void setCardiacOutputTotal(double cardiacOutputTotal) { this.cardiacOutputTotal = cardiacOutputTotal; }

    public double getPulmonaryArterySystolic() { return pulmonaryArterySystolic; }
    public void setPulmonaryArterySystolic(double pulmonaryArterySystolic) { this.pulmonaryArterySystolic = pulmonaryArterySystolic; }

    public double getPulmonaryArteryDiastolic() { return pulmonaryArteryDiastolic; }
    public void setPulmonaryArteryDiastolic(double pulmonaryArteryDiastolic) { this.pulmonaryArteryDiastolic = pulmonaryArteryDiastolic; }

    public double getCentralVenousPressure() { return centralVenousPressure; }
    public void setCentralVenousPressure(double centralVenousPressure) { this.centralVenousPressure = centralVenousPressure; }

    public double getPulmonaryCapillaryWedgePressure() { return pulmonaryCapillaryWedgePressure; }
    public void setPulmonaryCapillaryWedgePressure(double pulmonaryCapillaryWedgePressure) { this.pulmonaryCapillaryWedgePressure = pulmonaryCapillaryWedgePressure; }

    public double getSerumLactate() { return serumLactate; }
    public void setSerumLactate(double serumLactate) { this.serumLactate = serumLactate; }

    public double getPlasmaFreeHbMgDl() { return plasmaFreeHbMgDl; }
    public void setPlasmaFreeHbMgDl(double plasmaFreeHbMgDl) { this.plasmaFreeHbMgDl = plasmaFreeHbMgDl; }

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
}
