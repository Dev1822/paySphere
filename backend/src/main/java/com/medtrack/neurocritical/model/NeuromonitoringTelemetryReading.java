package com.medtrack.neurocritical.model;

import java.time.Instant;

/**
 * Real-time multimodal neuromonitoring (MMN) telemetry reading.
 */
public class NeuromonitoringTelemetryReading {
    private Instant timestamp;
    private double intracranialPressure; // ICP in mmHg (target <= 20-22)
    private double meanArterialPressure; // MAP in mmHg
    private double cerebralPerfusionPressure; // CPP in mmHg (CPP = MAP - ICP)
    private double brainTissueOxygenPbtO2; // PbtO2 in mmHg (target >= 20-25)
    private double npiLeftEye; // Neurological Pupil index (0.0 - 5.0)
    private double npiRightEye;
    private double pressureReactivityIndexPRx; // PRx correlation (-1.0 to +1.0)
    private double tcdMeanMcaVelocity; // cm/s
    private double lindegaardRatio; // MCA / Extracranial ICA ratio
    private double burstSuppressionRatio; // % (0 - 100)
    private double coreBodyTemperatureC; // C
    private String lundbergWaveType; // NONE, LUNDBERG_A_PLATEAU, LUNDBERG_B_RHYTHMIC, LUNDBERG_C

    public NeuromonitoringTelemetryReading() {
        this.timestamp = Instant.now();
    }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public double getIntracranialPressure() { return intracranialPressure; }
    public void setIntracranialPressure(double intracranialPressure) { this.intracranialPressure = intracranialPressure; }

    public double getMeanArterialPressure() { return meanArterialPressure; }
    public void setMeanArterialPressure(double meanArterialPressure) { this.meanArterialPressure = meanArterialPressure; }

    public double getCerebralPerfusionPressure() { return cerebralPerfusionPressure; }
    public void setCerebralPerfusionPressure(double cerebralPerfusionPressure) { this.cerebralPerfusionPressure = cerebralPerfusionPressure; }

    public double getBrainTissueOxygenPbtO2() { return brainTissueOxygenPbtO2; }
    public void setBrainTissueOxygenPbtO2(double brainTissueOxygenPbtO2) { this.brainTissueOxygenPbtO2 = brainTissueOxygenPbtO2; }

    public double getNpiLeftEye() { return npiLeftEye; }
    public void setNpiLeftEye(double npiLeftEye) { this.npiLeftEye = npiLeftEye; }

    public double getNpiRightEye() { return npiRightEye; }
    public void setNpiRightEye(double npiRightEye) { this.npiRightEye = npiRightEye; }

    public double getPressureReactivityIndexPRx() { return pressureReactivityIndexPRx; }
    public void setPressureReactivityIndexPRx(double pressureReactivityIndexPRx) { this.pressureReactivityIndexPRx = pressureReactivityIndexPRx; }

    public double getTcdMeanMcaVelocity() { return tcdMeanMcaVelocity; }
    public void setTcdMeanMcaVelocity(double tcdMeanMcaVelocity) { this.tcdMeanMcaVelocity = tcdMeanMcaVelocity; }

    public double getLindegaardRatio() { return lindegaardRatio; }
    public void setLindegaardRatio(double lindegaardRatio) { this.lindegaardRatio = lindegaardRatio; }

    public double getBurstSuppressionRatio() { return burstSuppressionRatio; }
    public void setBurstSuppressionRatio(double burstSuppressionRatio) { this.burstSuppressionRatio = burstSuppressionRatio; }

    public double getCoreBodyTemperatureC() { return coreBodyTemperatureC; }
    public void setCoreBodyTemperatureC(double coreBodyTemperatureC) { this.coreBodyTemperatureC = coreBodyTemperatureC; }

    public String getLundbergWaveType() { return lundbergWaveType; }
    public void setLundbergWaveType(String lundbergWaveType) { this.lundbergWaveType = lundbergWaveType; }
}
