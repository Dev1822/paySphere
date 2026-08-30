package com.medtrack.oncology.dto;

import com.medtrack.oncology.model.GenomicVariantProfile;
import java.util.List;

public class OncologyAssessmentRequest {
    private String patientId;
    private String cancerType;
    private String clinicalStage;
    private double tumorMutationalBurden; // Mut/Mb
    private String msiStatus; // MSS, MSI_LOW, MSI_HIGH
    private double hrdScore; // Homologous Recombination Deficiency Score (0 - 100)
    private double pdl1TpsPercent; // PD-L1 Tumor Proportion Score % (0 - 100)
    private List<GenomicVariantProfile> somaticVariants;

    public OncologyAssessmentRequest() {}

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getCancerType() { return cancerType; }
    public void setCancerType(String cancerType) { this.cancerType = cancerType; }

    public String getClinicalStage() { return clinicalStage; }
    public void setClinicalStage(String clinicalStage) { this.clinicalStage = clinicalStage; }

    public double getTumorMutationalBurden() { return tumorMutationalBurden; }
    public void setTumorMutationalBurden(double tumorMutationalBurden) { this.tumorMutationalBurden = tumorMutationalBurden; }

    public String getMsiStatus() { return msiStatus; }
    public void setMsiStatus(String msiStatus) { this.msiStatus = msiStatus; }

    public double getHrdScore() { return hrdScore; }
    public void setHrdScore(double hrdScore) { this.hrdScore = hrdScore; }

    public double getPdl1TpsPercent() { return pdl1TpsPercent; }
    public void setPdl1TpsPercent(double pdl1TpsPercent) { this.pdl1TpsPercent = pdl1TpsPercent; }

    public List<GenomicVariantProfile> getSomaticVariants() { return somaticVariants; }
    public void setSomaticVariants(List<GenomicVariantProfile> somaticVariants) { this.somaticVariants = somaticVariants; }
}
