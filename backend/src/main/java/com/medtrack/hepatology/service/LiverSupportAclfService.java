package com.medtrack.hepatology.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Extracorporeal Liver Support & ACLF Decision Support Service.
 *
 * Implements EASL-CLIF Consortium diagnostic criteria, CLIF-C ACLF prognostic score,
 * and OPTN MELD-3.0 scoring for acute-on-chronic liver failure.
 */
public class LiverSupportAclfService {

    public static class ClifAclfResult {
        private final int aclfGrade;
        private final int clifOfScore;
        private final double clifCAclfScore;
        private final double predictedMortality28d;
        private final String severityCategory;

        public ClifAclfResult(int aclfGrade, int clifOfScore, double clifCAclfScore,
                              double predictedMortality28d, String severityCategory) {
            this.aclfGrade = aclfGrade;
            this.clifOfScore = clifOfScore;
            this.clifCAclfScore = clifCAclfScore;
            this.predictedMortality28d = predictedMortality28d;
            this.severityCategory = severityCategory;
        }

        public int getAclfGrade() { return aclfGrade; }
        public int getClifOfScore() { return clifOfScore; }
        public double getClifCAclfScore() { return clifCAclfScore; }
        public double getPredictedMortality28d() { return predictedMortality28d; }
        public String getSeverityCategory() { return severityCategory; }
    }

    public static class Meld3Result {
        private final int meld3Score;
        private final String transplantListingPriority;

        public Meld3Result(int meld3Score, String transplantListingPriority) {
            this.meld3Score = meld3Score;
            this.transplantListingPriority = transplantListingPriority;
        }

        public int getMeld3Score() { return meld3Score; }
        public String getTransplantListingPriority() { return transplantListingPriority; }
    }

    /**
     * Determine EASL-CLIF ACLF Grade and CLIF-C Prognostic Score.
     */
    public ClifAclfResult evaluateClifAclf(double bilirubin, double creatinine, int westHavenHeGrade,
                                           double inr, boolean onVasopressor, int ageYears, double wbcCount) {
        int failedCount = 0;
        int liverScore = bilirubin >= 12.0 ? 3 : (bilirubin >= 6.0 ? 2 : 1);
        int kidneyScore = creatinine >= 3.5 ? 3 : (creatinine >= 2.0 ? 2 : 1);
        int brainScore = westHavenHeGrade >= 3 ? 3 : (westHavenHeGrade >= 1 ? 2 : 1);
        int coagScore = inr >= 2.5 ? 3 : (inr >= 2.0 ? 2 : 1);
        int circScore = onVasopressor ? 3 : 1;

        if (liverScore == 3) failedCount++;
        if (kidneyScore >= 2) failedCount++;
        if (brainScore == 3) failedCount++;
        if (coagScore == 3) failedCount++;
        if (circScore == 3) failedCount++;

        int aclfGrade = 0;
        if (failedCount >= 3) aclfGrade = 3;
        else if (failedCount == 2) aclfGrade = 2;
        else if (failedCount == 1) aclfGrade = 1;

        int clifOf = liverScore + kidneyScore + brainScore + coagScore + circScore + 1;
        double clifC = 10.0 * (0.33 * clifOf + 0.04 * ageYears + 0.63 * Math.log(Math.max(1.0, wbcCount)) - 2.0);
        double mortality = Math.min(95.0, Math.max(5.0, 100.0 / (1.0 + Math.exp(-0.12 * (clifC - 50.0)))));

        String category = aclfGrade >= 3 ? "CRITICAL_ACLF_GRADE_3" : (aclfGrade == 2 ? "MODERATE_ACLF_GRADE_2" : "MILD_ACLF_GRADE_1");

        return new ClifAclfResult(aclfGrade, clifOf, Math.round(clifC * 10.0) / 10.0, Math.round(mortality * 10.0) / 10.0, category);
    }

    /**
     * Determine OPTN MELD-3.0 Score.
     */
    public Meld3Result calculateMeld3(boolean isFemale, double bilirubin, double inr,
                                      double creatinine, double sodium, double albumin) {
        double bili = Math.max(1.0, bilirubin);
        double inrVal = Math.max(1.0, inr);
        double cr = Math.min(3.0, Math.max(1.0, creatinine));
        double na = Math.min(137.0, Math.max(125.0, sodium));
        double alb = Math.min(3.5, Math.max(1.5, albumin));

        double femaleTerm = isFemale ? 1.33 : 0.0;
        double raw = femaleTerm + 4.56 * Math.log(bili) + 0.82 * (137.0 - na)
                - 0.24 * (137.0 - na) * Math.log(bili) + 9.09 * Math.log(inrVal)
                + 11.14 * Math.log(cr) + 1.85 * (3.5 - alb) - 1.83 * (3.5 - alb) * Math.log(cr) + 6.0;

        int score = (int) Math.min(40, Math.max(6, Math.round(raw)));
        String priority = score >= 35 ? "STATUS_1B_URGENT" : (score >= 25 ? "HIGH_PRIORITY" : "ELECTIVE_LISTING");

        return new Meld3Result(score, priority);
    }
}
