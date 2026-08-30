package com.medtrack.nephrology.model;

import java.time.Instant;

/**
 * Real-time continuous renal replacement therapy circuit telemetry reading.
 */
public class CrrtTelemetryReading {
    private Instant timestamp;
    private double bloodFlowRateQb; // mL/min (typically 100 - 250)
    private double dialysateFlowRateQd; // mL/h
    private double replacementPreFilterRate; // mL/h
    private double replacementPostFilterRate; // mL/h
    private double netUltrafiltrationRate; // mL/h
    private double accessPressure; // mmHg (negative, typically -50 to -150)
    private double returnPressure; // mmHg (positive, typically +50 to +150)
    private double filterPressure; // mmHg (positive, typically +100 to +250)
    private double effluentPressure; // mmHg
    private double transmembranePressure; // TMP in mmHg
    private double filterPressureDrop; // Delta P in mmHg
    private double postFilterIonizedCalcium; // mmol/L (target 0.25 - 0.40)
    private double systemicIonizedCalcium; // mmol/L (target 1.10 - 1.30)
    private double totalSerumCalcium; // mg/dL or mmol/L

    public CrrtTelemetryReading() {
        this.timestamp = Instant.now();
    }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public double getBloodFlowRateQb() { return bloodFlowRateQb; }
    public void setBloodFlowRateQb(double bloodFlowRateQb) { this.bloodFlowRateQb = bloodFlowRateQb; }

    public double getDialysateFlowRateQd() { return dialysateFlowRateQd; }
    public void setDialysateFlowRateQd(double dialysateFlowRateQd) { this.dialysateFlowRateQd = dialysateFlowRateQd; }

    public double getReplacementPreFilterRate() { return replacementPreFilterRate; }
    public void setReplacementPreFilterRate(double replacementPreFilterRate) { this.replacementPreFilterRate = replacementPreFilterRate; }

    public double getReplacementPostFilterRate() { return replacementPostFilterRate; }
    public void setReplacementPostFilterRate(double replacementPostFilterRate) { this.replacementPostFilterRate = replacementPostFilterRate; }

    public double getNetUltrafiltrationRate() { return netUltrafiltrationRate; }
    public void setNetUltrafiltrationRate(double netUltrafiltrationRate) { this.netUltrafiltrationRate = netUltrafiltrationRate; }

    public double getAccessPressure() { return accessPressure; }
    public void setAccessPressure(double accessPressure) { this.accessPressure = accessPressure; }

    public double getReturnPressure() { return returnPressure; }
    public void setReturnPressure(double returnPressure) { this.returnPressure = returnPressure; }

    public double getFilterPressure() { return filterPressure; }
    public void setFilterPressure(double filterPressure) { this.filterPressure = filterPressure; }

    public double getEffluentPressure() { return effluentPressure; }
    public void setEffluentPressure(double effluentPressure) { this.effluentPressure = effluentPressure; }

    public double getTransmembranePressure() { return transmembranePressure; }
    public void setTransmembranePressure(double transmembranePressure) { this.transmembranePressure = transmembranePressure; }

    public double getFilterPressureDrop() { return filterPressureDrop; }
    public void setFilterPressureDrop(double filterPressureDrop) { this.filterPressureDrop = filterPressureDrop; }

    public double getPostFilterIonizedCalcium() { return postFilterIonizedCalcium; }
    public void setPostFilterIonizedCalcium(double postFilterIonizedCalcium) { this.postFilterIonizedCalcium = postFilterIonizedCalcium; }

    public double getSystemicIonizedCalcium() { return systemicIonizedCalcium; }
    public void setSystemicIonizedCalcium(double systemicIonizedCalcium) { this.systemicIonizedCalcium = systemicIonizedCalcium; }

    public double getTotalSerumCalcium() { return totalSerumCalcium; }
    public void setTotalSerumCalcium(double totalSerumCalcium) { this.totalSerumCalcium = totalSerumCalcium; }
}
