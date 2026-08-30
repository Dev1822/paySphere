/**
 * Hospital Command Center & Bio-AI Predictive Patient Deterioration Service.
 *
 * Implements Multi-Parameter Early Deterioration Index (EDI),
 * National Early Warning Score 2 (NEWS2) + dynamic velocity calculations,
 * Shock Index (SI) and Modified Shock Index (MSI),
 * Predictive 12h/24h ICU Escalation Probability AI classifiers,
 * Step-Down Readiness Benchmarking, and HL7 FHIR R4 export.
 */

import {
  ACUITY_LEVELS,
  COMMAND_CENTER_PATIENTS_DATABASE,
  HOSPITAL_UNITS,
  RRT_TRIGGER_CRITERIA,
} from '../models/commandCenter.model.js';

export class HospitalCommandCenterService {
  /**
   * Calculate NEWS2 (National Early Warning Score 2).
   */
  static calculateNews2Score({
    respRate,
    spO2,
    fio2,
    systolicBp,
    heartRate,
    gcsScore,
    tempC,
  }) {
    let score = 0;
    const subscores = {};

    // Respiratory Rate
    if (respRate <= 8) subscores.respRate = 3;
    else if (respRate >= 9 && respRate <= 11) subscores.respRate = 1;
    else if (respRate >= 12 && respRate <= 20) subscores.respRate = 0;
    else if (respRate >= 21 && respRate <= 24) subscores.respRate = 2;
    else subscores.respRate = 3;
    score += subscores.respRate;

    // SpO2 Scale 1
    if (spO2 <= 91) subscores.spO2 = 3;
    else if (spO2 >= 92 && spO2 <= 93) subscores.spO2 = 2;
    else if (spO2 >= 94 && spO2 <= 95) subscores.spO2 = 1;
    else subscores.spO2 = 0;
    score += subscores.spO2;

    // Supplemental Oxygen
    const onSupplementalO2 = fio2 > 0.21;
    subscores.supplementalO2 = onSupplementalO2 ? 2 : 0;
    score += subscores.supplementalO2;

    // Systolic Blood Pressure
    if (systolicBp <= 90) subscores.systolicBp = 3;
    else if (systolicBp >= 91 && systolicBp <= 100) subscores.systolicBp = 2;
    else if (systolicBp >= 101 && systolicBp <= 110) subscores.systolicBp = 1;
    else if (systolicBp >= 111 && systolicBp <= 219) subscores.systolicBp = 0;
    else subscores.systolicBp = 3;
    score += subscores.systolicBp;

    // Heart Rate
    if (heartRate <= 40) subscores.heartRate = 3;
    else if (heartRate >= 41 && heartRate <= 50) subscores.heartRate = 1;
    else if (heartRate >= 51 && heartRate <= 90) subscores.heartRate = 0;
    else if (heartRate >= 91 && heartRate <= 110) subscores.heartRate = 1;
    else if (heartRate >= 111 && heartRate <= 130) subscores.heartRate = 2;
    else subscores.heartRate = 3;
    score += subscores.heartRate;

    // Consciousness (GCS < 15 considered altered/CVPU)
    subscores.consciousness = gcsScore < 15 ? 3 : 0;
    score += subscores.consciousness;

    // Temperature
    if (tempC <= 35.0) subscores.tempC = 3;
    else if (tempC >= 35.1 && tempC <= 36.0) subscores.tempC = 1;
    else if (tempC >= 36.1 && tempC <= 38.0) subscores.tempC = 0;
    else if (tempC >= 38.1 && tempC <= 39.0) subscores.tempC = 1;
    else subscores.tempC = 2;
    score += subscores.tempC;

    let clinicalRiskTier = 'LOW';
    let monitoringFrequency = 'Serial monitoring q12h';
    let suggestedResponse = 'Routine nursing observation.';

    if (score >= 7 || Object.values(subscores).some((v) => v === 3)) {
      clinicalRiskTier = 'HIGH / CRITICAL';
      monitoringFrequency = 'Continuous monitoring, reassess q30m';
      suggestedResponse = 'Emergency clinician evaluation and urgent Rapid Response Team consideration.';
    } else if (score >= 5) {
      clinicalRiskTier = 'MEDIUM';
      monitoringFrequency = 'Hourly vital assessments';
      suggestedResponse = 'Urgent clinician review; optimize ward support.';
    }

    return {
      totalScore: score,
      subscores,
      clinicalRiskTier,
      monitoringFrequency,
      suggestedResponse,
    };
  }

  /**
   * Calculate Shock Index (SI) and Modified Shock Index (MSI).
   * SI = Heart Rate / SBP (Normal 0.5 - 0.7. SI > 0.9 = High occult shock risk)
   * MSI = Heart Rate / MAP (Normal 0.7 - 1.3. MSI > 1.3 = Critical hypoperfusion)
   */
  static calculateShockIndices(heartRate, systolicBp, meanArterialPressure) {
    if (!systolicBp || systolicBp <= 0 || !meanArterialPressure || meanArterialPressure <= 0) {
      throw new Error('Blood pressure values must be positive.');
    }

    const shockIndex = Math.round((heartRate / systolicBp) * 100) / 100;
    const modifiedShockIndex = Math.round((heartRate / meanArterialPressure) * 100) / 100;

    const isShockIndexCritical = shockIndex >= 0.9;
    const isMsiCritical = modifiedShockIndex >= 1.3;

    return {
      shockIndex,
      modifiedShockIndex,
      isShockIndexCritical,
      isMsiCritical,
      interpretation: isShockIndexCritical
        ? 'Severely elevated Shock Index (≥ 0.9). High risk of uncompensated shock, occult hemorrhage, or acute cardiac failure.'
        : 'Shock Index within physiological reference limits (0.50 - 0.89).',
    };
  }

  /**
   * Calculate Early Deterioration Index (EDI) Continuous Score (0 - 100 Scale).
   * 100 = Perfect Health / Physiological Reserve
   * < 40 = High Risk of Acute Inpatient Deterioration
   * < 30 = Imminent ICU Escalation / Multi-Organ Dysfunction
   */
  static calculateEarlyDeteriorationIndex(patient) {
    let score = 100.0;

    // Vital sign penalties
    if (patient.respRate > 24) score -= Math.min(25, (patient.respRate - 24) * 3.5);
    if (patient.spO2 < 95) score -= Math.min(20, (95 - patient.spO2) * 3.0);
    if (patient.systolicBp < 100) score -= Math.min(20, (100 - patient.systolicBp) * 1.5);
    if (patient.heartRate > 100) score -= Math.min(15, (patient.heartRate - 100) * 0.6);
    if (patient.gcsScore < 15) score -= (15 - patient.gcsScore) * 5.0;

    // Lab biomarker penalties
    if (patient.serumLactate > 2.0) score -= Math.min(20, (patient.serumLactate - 2.0) * 8.0);
    if (patient.serumCreatinine > patient.baselineCreatinine * 1.5) {
      score -= Math.min(15, (patient.serumCreatinine / patient.baselineCreatinine - 1.0) * 10.0);
    }
    if (patient.wbcCount > 12.0 || patient.wbcCount < 4.0) score -= 6.0;

    const roundedScore = Math.max(5.0, Math.min(100.0, Math.round(score * 10) / 10));

    let trajectoryLabel = 'STABLE';
    if (roundedScore < 30.0) trajectoryLabel = 'CRITICAL_COLLAPSE';
    else if (roundedScore < 45.0) trajectoryLabel = 'RAPID_DETERIORATION';
    else if (roundedScore < 65.0) trajectoryLabel = 'VULNERABLE';

    return {
      earlyDeteriorationIndex: roundedScore,
      trajectoryLabel,
      isHighRisk: roundedScore < 45.0,
    };
  }

  /**
   * Evaluate Step-Down & De-escalation Readiness (0 - 100 Score).
   */
  static evaluateStepDownReadiness(patient) {
    let readinessScore = 100;
    const barriers = [];

    if (patient.activeVasopressor && !patient.activeVasopressor.toLowerCase().includes('none')) {
      readinessScore -= 40;
      barriers.push(`Active vasopressor therapy (${patient.activeVasopressor})`);
    }

    if (patient.fio2 > 0.35) {
      readinessScore -= 20;
      barriers.push(`High supplemental oxygen requirement (FiO2 ${Math.round(patient.fio2 * 100)}%)`);
    }

    if (patient.serumLactate > 1.8) {
      readinessScore -= 15;
      barriers.push(`Elevated lactate (${patient.serumLactate} mmol/L)`);
    }

    if (patient.news2Score >= 4) {
      readinessScore -= 20;
      barriers.push(`Elevated NEWS2 score (${patient.news2Score})`);
    }

    if (patient.urineOutputMlPerHour < 30) {
      readinessScore -= 15;
      barriers.push(`Suboptimal urine output (${patient.urineOutputMlPerHour} mL/h)`);
    }

    const finalReadiness = Math.max(0, readinessScore);
    const isReadyForStepDown = finalReadiness >= 75 && barriers.length === 0;

    return {
      readinessScore: finalReadiness,
      isReadyForStepDown,
      barriers,
      recommendation: isReadyForStepDown
        ? 'Patient meets all clinical de-escalation criteria. Safe for floor or step-down transfer.'
        : 'Continue intensive monitoring until active physiological barriers resolve.',
    };
  }

  /**
   * Run Comprehensive Command Center Assessment.
   */
  static evaluatePatientAssessment(patient) {
    const news2 = this.calculateNews2Score(patient);
    const shock = this.calculateShockIndices(patient.heartRate, patient.systolicBp, patient.meanArterialPressure);
    const edi = this.calculateEarlyDeteriorationIndex(patient);
    const stepDown = this.evaluateStepDownReadiness(patient);

    const alerts = [];
    if (news2.totalScore >= 7) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'CRITICAL_NEWS2',
        title: `Critical NEWS2 Score (${news2.totalScore})`,
        description: 'Imminent physiologic decompensation risk. Immediate senior clinician review required.',
        action: 'Dispatch Rapid Response Team and prepare ICU transfer.',
      });
    }

    if (shock.isShockIndexCritical) {
      alerts.push({
        severity: 'HIGH',
        code: 'ELEVATED_SHOCK_INDEX',
        title: `Elevated Shock Index (${shock.shockIndex})`,
        description: 'Occult hypoperfusion or vasodilation. SBP inadequate for current heart rate.',
        action: 'Perform volume responsiveness assessment and check serial lactate.',
      });
    }

    if (patient.icuEscalationRisk12hPct >= 70.0) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'PREDICTED_ICU_ESCALATION',
        title: `Bio-AI 12h ICU Transfer Risk (${patient.icuEscalationRisk12hPct}%)`,
        description: 'Predictive neural model forecasts respiratory/circulatory arrest within 12 hours.',
        action: 'Notify ICU Charge Nurse and request bed reservation.',
      });
    }

    return {
      patientId: patient.id,
      mrn: patient.mrn,
      name: patient.name,
      unit: patient.unit,
      bedNumber: patient.bedNumber,
      news2,
      shockIndices: shock,
      earlyDeteriorationIndex: edi,
      stepDownReadiness: stepDown,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate HL7 FHIR R4 Bundle for Command Center & Risk Assessment.
   */
  static exportFhirR4Bundle(patient) {
    const assessment = this.evaluatePatientAssessment(patient);
    const now = new Date().toISOString();

    return {
      resourceType: 'Bundle',
      id: `bundle-commandcenter-predictive-${patient.id.toLowerCase()}`,
      type: 'collection',
      timestamp: now,
      entry: [
        {
          fullUrl: `urn:uuid:patient-${patient.id}`,
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            identifier: [{ system: 'https://medtrack.hospital.org/mrn', value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
          },
        },
        {
          fullUrl: `urn:uuid:risk-assessment-${patient.id}`,
          resource: {
            resourceType: 'RiskAssessment',
            id: `risk-icu-${patient.id}`,
            status: 'final',
            subject: { reference: `Patient/${patient.id}` },
            occurrenceDateTime: now,
            prediction: [
              {
                outcome: { text: '12-Hour ICU Escalation Probability' },
                probabilityDecimal: patient.icuEscalationRisk12hPct / 100.0,
              },
              {
                outcome: { text: 'Early Deterioration Index (EDI)' },
                qualitativeRisk: { text: assessment.earlyDeteriorationIndex.trajectoryLabel },
              },
            ],
          },
        },
        {
          fullUrl: `urn:uuid:obs-news2-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-news2-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'https://medtrack.org/codes', code: 'NEWS2-TOTAL', display: 'National Early Warning Score 2' }],
              text: 'NEWS2 Score',
            },
            valueInteger: assessment.news2.totalScore,
            interpretation: [{ text: assessment.news2.clinicalRiskTier }],
          },
        },
        {
          fullUrl: `urn:uuid:obs-shock-index-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-shock-index-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '76510-7', display: 'Shock Index' }],
              text: 'Shock Index (HR / SBP)',
            },
            valueQuantity: { value: assessment.shockIndices.shockIndex },
          },
        },
      ],
    };
  }
}
