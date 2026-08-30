package com.medtrack.circulatory.dto;

/**
 * Result of Cardiac Power Output calculation.
 */
public class CardiacPowerOutputResult {

    private double cardiacPowerOutputWatts;
    private boolean isSevereShock;
    private boolean isAdequateReserve;
    private String hemodynamicInterpretation;

    public CardiacPowerOutputResult() {}

    public CardiacPowerOutputResult(double cardiacPowerOutputWatts, boolean isSevereShock,
                                    boolean isAdequateReserve, String hemodynamicInterpretation) {
        this.cardiacPowerOutputWatts = cardiacPowerOutputWatts;
        this.isSevereShock = isSevereShock;
        this.isAdequateReserve = isAdequateReserve;
        this.hemodynamicInterpretation = hemodynamicInterpretation;
    }

    public double getCardiacPowerOutputWatts() { return cardiacPowerOutputWatts; }
    public void setCardiacPowerOutputWatts(double cardiacPowerOutputWatts) { this.cardiacPowerOutputWatts = cardiacPowerOutputWatts; }

    public boolean isSevereShock() { return isSevereShock; }
    public void setSevereShock(boolean severeShock) { isSevereShock = severeShock; }

    public boolean isAdequateReserve() { return isAdequateReserve; }
    public void setAdequateReserve(boolean adequateReserve) { isAdequateReserve = adequateReserve; }

    public String getHemodynamicInterpretation() { return hemodynamicInterpretation; }
    public void setHemodynamicInterpretation(String hemodynamicInterpretation) { this.hemodynamicInterpretation = hemodynamicInterpretation; }
}
