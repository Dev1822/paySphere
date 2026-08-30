package com.medtrack.oncology.model;

/**
 * Somatic / Germline Genomic Variant Profile according to AMP/ASCO/CAP guidelines.
 */
public class GenomicVariantProfile {
    private String geneSymbol;
    private String cdnaChange;
    private String proteinChange;
    private double variantAlleleFraction; // VAF % (0 - 100)
    private String variantType; // SNV, INDEL, COPY_NUMBER_GAIN, REARRANGEMENT
    private String actionabilityTier; // TIER_I_STRONG, TIER_II_POTENTIAL, TIER_III_UNKNOWN, TIER_IV_BENIGN
    private String fdaApprovedTherapy;
    private String resistanceImplication;

    public GenomicVariantProfile() {}

    public GenomicVariantProfile(String geneSymbol, String cdnaChange, String proteinChange,
                                double variantAlleleFraction, String variantType,
                                String actionabilityTier, String fdaApprovedTherapy,
                                String resistanceImplication) {
        this.geneSymbol = geneSymbol;
        this.cdnaChange = cdnaChange;
        this.proteinChange = proteinChange;
        this.variantAlleleFraction = variantAlleleFraction;
        this.variantType = variantType;
        this.actionabilityTier = actionabilityTier;
        this.fdaApprovedTherapy = fdaApprovedTherapy;
        this.resistanceImplication = resistanceImplication;
    }

    public String getGeneSymbol() { return geneSymbol; }
    public void setGeneSymbol(String geneSymbol) { this.geneSymbol = geneSymbol; }

    public String getCdnaChange() { return cdnaChange; }
    public void setCdnaChange(String cdnaChange) { this.cdnaChange = cdnaChange; }

    public String getProteinChange() { return proteinChange; }
    public void setProteinChange(String proteinChange) { this.proteinChange = proteinChange; }

    public double getVariantAlleleFraction() { return variantAlleleFraction; }
    public void setVariantAlleleFraction(double variantAlleleFraction) { this.variantAlleleFraction = variantAlleleFraction; }

    public String getVariantType() { return variantType; }
    public void setVariantType(String variantType) { this.variantType = variantType; }

    public String getActionabilityTier() { return actionabilityTier; }
    public void setActionabilityTier(String actionabilityTier) { this.actionabilityTier = actionabilityTier; }

    public String getFdaApprovedTherapy() { return fdaApprovedTherapy; }
    public void setFdaApprovedTherapy(String fdaApprovedTherapy) { this.fdaApprovedTherapy = fdaApprovedTherapy; }

    public String getResistanceImplication() { return resistanceImplication; }
    public void setResistanceImplication(String resistanceImplication) { this.resistanceImplication = resistanceImplication; }
}
