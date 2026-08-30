package com.medtrack.circulatory.model;

/**
 * Mechanical Circulatory Support Device Types.
 */
public enum McsDeviceType {
    IMPELLA_CP("Impella CP with SmartAssist", 4.0, 14),
    IMPELLA_5_5("Impella 5.5 with SmartAssist", 5.5, 21),
    IMPELLA_RP("Impella RP Flex Right Ventricular Support", 4.0, 22),
    HEARTMATE_3_LVAD("HeartMate 3 MagLev Left Ventricular Assist System", 10.0, 0);

    private final String displayName;
    private final double maxFlowLitersMin;
    private final int frenchSize;

    McsDeviceType(String displayName, double maxFlowLitersMin, int frenchSize) {
        this.displayName = displayName;
        this.maxFlowLitersMin = maxFlowLitersMin;
        this.frenchSize = frenchSize;
    }

    public String getDisplayName() { return displayName; }
    public double getMaxFlowLitersMin() { return maxFlowLitersMin; }
    public int getFrenchSize() { return frenchSize; }
}
