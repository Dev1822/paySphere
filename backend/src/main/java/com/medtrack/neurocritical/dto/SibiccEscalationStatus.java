package com.medtrack.neurocritical.dto;

import java.util.List;

public class SibiccEscalationStatus {
    private String currentTier; // TIER_0, TIER_1, TIER_2, TIER_3
    private String tierDescription;
    private boolean refractoryIntracranialHypertension;
    private List<String> recommendedInterventions;
    private List<String> contraindicatedActions;

    public SibiccEscalationStatus() {}

    public SibiccEscalationStatus(String currentTier, String tierDescription,
                                 boolean refractoryIntracranialHypertension,
                                 List<String> recommendedInterventions,
                                 List<String> contraindicatedActions) {
        this.currentTier = currentTier;
        this.tierDescription = tierDescription;
        this.refractoryIntracranialHypertension = refractoryIntracranialHypertension;
        this.recommendedInterventions = recommendedInterventions;
        this.contraindicatedActions = contraindicatedActions;
    }

    public String getCurrentTier() { return currentTier; }
    public void setCurrentTier(String currentTier) { this.currentTier = currentTier; }

    public String getTierDescription() { return tierDescription; }
    public void setTierDescription(String tierDescription) { this.tierDescription = tierDescription; }

    public boolean isRefractoryIntracranialHypertension() { return refractoryIntracranialHypertension; }
    public void setRefractoryIntracranialHypertension(boolean refractoryIntracranialHypertension) { this.refractoryIntracranialHypertension = refractoryIntracranialHypertension; }

    public List<String> getRecommendedInterventions() { return recommendedInterventions; }
    public void setRecommendedInterventions(List<String> recommendedInterventions) { this.recommendedInterventions = recommendedInterventions; }

    public List<String> getContraindicatedActions() { return contraindicatedActions; }
    public void setContraindicatedActions(List<String> contraindicatedActions) { this.contraindicatedActions = contraindicatedActions; }
}
