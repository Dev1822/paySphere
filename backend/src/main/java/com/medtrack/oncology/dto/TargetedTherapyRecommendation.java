package com.medtrack.oncology.dto;

public class TargetedTherapyRecommendation {
    private String drugName;
    private String targetMechanism;
    private String esmoEscatTier; // ESCAT I-A, I-B, II-A, III, IV
    private String nccnEvidenceLevel; // Category 1, Category 2A, Category 2B
    private String clinicalRationale;
    private boolean isOffLabel;

    public TargetedTherapyRecommendation() {}

    public TargetedTherapyRecommendation(String drugName, String targetMechanism, String esmoEscatTier,
                                       String nccnEvidenceLevel, String clinicalRationale, boolean isOffLabel) {
        this.drugName = drugName;
        this.targetMechanism = targetMechanism;
        this.esmoEscatTier = esmoEscatTier;
        this.nccnEvidenceLevel = nccnEvidenceLevel;
        this.clinicalRationale = clinicalRationale;
        this.isOffLabel = isOffLabel;
    }

    public String getDrugName() { return drugName; }
    public void setDrugName(String drugName) { this.drugName = drugName; }

    public String getTargetMechanism() { return targetMechanism; }
    public void setTargetMechanism(String targetMechanism) { this.targetMechanism = targetMechanism; }

    public String getEsmoEscatTier() { return esmoEscatTier; }
    public void setEsmoEscatTier(String esmoEscatTier) { this.esmoEscatTier = esmoEscatTier; }

    public String getNccnEvidenceLevel() { return nccnEvidenceLevel; }
    public void setNccnEvidenceLevel(String nccnEvidenceLevel) { this.nccnEvidenceLevel = nccnEvidenceLevel; }

    public String getClinicalRationale() { return clinicalRationale; }
    public void setClinicalRationale(String clinicalRationale) { this.clinicalRationale = clinicalRationale; }

    public boolean isOffLabel() { return isOffLabel; }
    public void setOffLabel(boolean offLabel) { isOffLabel = offLabel; }
}
