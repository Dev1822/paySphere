package com.medtrack.pulmonary.dto;

/**
 * Result of Spontaneous Breathing Trial (SBT) & RSBI extubation readiness evaluation.
 */
public class WeaningReadinessResult {

    private int rsbi;
    private boolean isFavorableForExtubation;
    private String rsbiInterpretation;
    private double spontaneousVtMl;
    private double spontaneousRr;
    private String recommendation;

    public WeaningReadinessResult() {}

    public WeaningReadinessResult(int rsbi, boolean isFavorableForExtubation,
                                  String rsbiInterpretation, double spontaneousVtMl,
                                  double spontaneousRr, String recommendation) {
        this.rsbi = rsbi;
        this.isFavorableForExtubation = isFavorableForExtubation;
        this.rsbiInterpretation = rsbiInterpretation;
        this.spontaneousVtMl = spontaneousVtMl;
        this.spontaneousRr = spontaneousRr;
        this.recommendation = recommendation;
    }

    public int getRsbi() { return rsbi; }
    public void setRsbi(int rsbi) { this.rsbi = rsbi; }

    public boolean isFavorableForExtubation() { return isFavorableForExtubation; }
    public void setFavorableForExtubation(boolean favorableForExtubation) { isFavorableForExtubation = favorableForExtubation; }

    public String getRsbiInterpretation() { return rsbiInterpretation; }
    public void setRsbiInterpretation(String rsbiInterpretation) { this.rsbiInterpretation = rsbiInterpretation; }

    public double getSpontaneousVtMl() { return spontaneousVtMl; }
    public void setSpontaneousVtMl(double spontaneousVtMl) { this.spontaneousVtMl = spontaneousVtMl; }

    public double getSpontaneousRr() { return spontaneousRr; }
    public void setSpontaneousRr(double spontaneousRr) { this.spontaneousRr = spontaneousRr; }

    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
}
