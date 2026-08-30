package com.medtrack.circulatory.dto;

/**
 * Result of Pulmonary Artery Pulsatility Index (PAPi) evaluation for RV failure.
 */
public class PapiEvaluationResult {

    private double pulmonaryArteryPulsatilityIndex;
    private double pulsePressureMmHg;
    private boolean isRvFailureRisk;
    private boolean isBorderline;
    private String interpretation;

    public PapiEvaluationResult() {}

    public PapiEvaluationResult(double pulmonaryArteryPulsatilityIndex, double pulsePressureMmHg,
                                boolean isRvFailureRisk, boolean isBorderline, String interpretation) {
        this.pulmonaryArteryPulsatilityIndex = pulmonaryArteryPulsatilityIndex;
        this.pulsePressureMmHg = pulsePressureMmHg;
        this.isRvFailureRisk = isRvFailureRisk;
        this.isBorderline = isBorderline;
        this.interpretation = interpretation;
    }

    public double getPulmonaryArteryPulsatilityIndex() { return pulmonaryArteryPulsatilityIndex; }
    public void setPulmonaryArteryPulsatilityIndex(double pulmonaryArteryPulsatilityIndex) { this.pulmonaryArteryPulsatilityIndex = pulmonaryArteryPulsatilityIndex; }

    public double getPulsePressureMmHg() { return pulsePressureMmHg; }
    public void setPulsePressureMmHg(double pulsePressureMmHg) { this.pulsePressureMmHg = pulsePressureMmHg; }

    public boolean isRvFailureRisk() { return isRvFailureRisk; }
    public void setRvFailureRisk(boolean rvFailureRisk) { isRvFailureRisk = rvFailureRisk; }

    public boolean isBorderline() { return isBorderline; }
    public void setBorderline(boolean borderline) { isBorderline = borderline; }

    public String getInterpretation() { return interpretation; }
    public void setInterpretation(String interpretation) { this.interpretation = interpretation; }
}
