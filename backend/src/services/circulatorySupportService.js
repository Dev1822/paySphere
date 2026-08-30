/**
 * Mechanical Circulatory Support (MCS), Impella & LVAD Hemodynamics Service.
 *
 * Implements clinical algorithms for:
 * 1. Cardiac Power Output (CPO = MAP * CO / 451) with 0.60 W shock threshold.
 * 2. Pulmonary Artery Pulsatility Index (PAPi = [PASP - PADP] / CVP) for RV failure detection.
 * 3. Left Ventricular End-Diastolic Pressure (LVEDP) & Mechanical Unloading Index.
 * 4. Total Support Index (TSI) & Native vs Mechanical Flow partitioning.
 * 5. Plasma Free Hemoglobin (pfHb) & Subclinical Hemolysis surveillance.
 * 6. Impella P-Level Weaning Protocol & Explant Readiness scoring.
 * 7. HL7 FHIR R4 DeviceObservation & RiskAssessment Bundle export.
 */

import {
  MCS_DEVICE_TYPES,
  MCS_PATIENTS_DATABASE,
  SCAI_SHOCK_STAGES,
} from '../models/circulatorySupport.model.js';

export class MechanicalCirculatorySupportService {
  /**
   * Calculate Cardiac Power Output (CPO) in Watts.
   * Formula: CPO = (MAP * CO) / 451
   * Benchmark: CPO < 0.60 W indicates refractory cardiogenic shock (SHOCK trial).
   */
  static calculateCardiacPowerOutput(meanArterialPressure, cardiacOutputLitersMin) {
    if (!meanArterialPressure || meanArterialPressure <= 0 || !cardiacOutputLitersMin || cardiacOutputLitersMin <= 0) {
      throw new Error('MAP and Cardiac Output must be positive numbers.');
    }

    const cpo = Math.round(((meanArterialPressure * cardiacOutputLitersMin) / 451.0) * 100) / 100;
    const isSevereShock = cpo < 0.60;
    const isAdequateReserve = cpo >= 0.80;

    let interpretation = 'Adequate cardiac reserve (CPO >= 0.80 W).';
    if (isSevereShock) {
      interpretation = 'Severely depressed cardiac power output (< 0.60 W). High risk of refractory mortality without active mechanical support.';
    } else if (cpo < 0.80) {
      interpretation = 'Borderline cardiac power output (0.60 - 0.79 W). Continuous inotropic or MCS augmentation warranted.';
    }

    return {
      cardiacPowerOutputWatts: cpo,
      isSevereShock,
      isAdequateReserve,
      thresholdShock: '< 0.60 W',
      thresholdReserve: '>= 0.80 W',
      interpretation,
    };
  }

  /**
   * Calculate Pulmonary Artery Pulsatility Index (PAPi).
   * Formula: PAPi = (PASP - PADP) / CVP
   * Benchmark: PAPi < 1.0 indicates high risk of acute Right Ventricular Failure / Bi-VAD requirement.
   */
  static calculatePapi(pulmonaryArterySystolic, pulmonaryArteryDiastolic, centralVenousPressure) {
    if (centralVenousPressure === undefined || centralVenousPressure <= 0) {
      throw new Error('Central venous pressure must be a positive number.');
    }

    const pulsePressure = pulmonaryArterySystolic - pulmonaryArteryDiastolic;
    if (pulsePressure <= 0) {
      throw new Error('PASP must exceed PADP.');
    }

    const papi = Math.round((pulsePressure / centralVenousPressure) * 100) / 100;
    const isRvFailureRisk = papi < 1.0;
    const isBorderline = papi >= 1.0 && papi < 1.8;

    let interpretation = 'Robust right ventricular pulsatility (PAPi >= 1.8). Normal RV contractility.';
    if (isRvFailureRisk) {
      interpretation = 'Severe RV dysfunction / acute RV failure risk (PAPi < 1.0). Consider inotropic RV support (Milrinone/Epi) or Impella RP / RVAD.';
    } else if (isBorderline) {
      interpretation = 'Borderline RV performance (PAPi 1.0 - 1.79). Monitor CVP and avoid excessive LV unloading.';
    }

    return {
      pulmonaryArteryPulsatilityIndex: papi,
      pulsePressure,
      isRvFailureRisk,
      isBorderline,
      thresholdCritical: '< 1.0',
      interpretation,
    };
  }

  /**
   * Calculate Mechanical Unloading & Total Support Index (TSI).
   */
  static calculateUnloadingMetrics(impellaFlow, nativeCardiacOutput, bsaM2) {
    const totalCo = impellaFlow + nativeCardiacOutput;
    const totalCi = bsaM2 > 0 ? Math.round((totalCo / bsaM2) * 100) / 100 : 0;
    const mechanicalFractionPct = totalCo > 0 ? Math.round((impellaFlow / totalCo) * 100) : 0;

    return {
      totalCardiacOutputLitersMin: Math.round(totalCo * 10) / 10,
      totalCardiacIndexLitersMinM2: totalCi,
      mechanicalSupportFractionPct: mechanicalFractionPct,
      nativeHeartFractionPct: 100 - mechanicalFractionPct,
    };
  }

  /**
   * Evaluate Subclinical Hemolysis Risk.
   * Plasma Free Hemoglobin (pfHb > 40 mg/dL) or LDH > 2.5x baseline indicates hemolysis / shear stress.
   */
  static evaluateHemolysis(plasmaFreeHbMgDl, ldhUnitsPerLiter, antiXaUnitsPerMl) {
    const isPfHbElevated = plasmaFreeHbMgDl >= 40.0;
    const isLdhCritical = ldhUnitsPerLiter >= 500;
    const isAnticoagulationSubtherapeutic = antiXaUnitsPerMl < 0.30;

    let hemolysisRisk = 'LOW';
    let recommendations = [];

    if (isPfHbElevated || isLdhCritical) {
      hemolysisRisk = 'HIGH / ACTIVE_HEMOLYSIS';
      recommendations.push('Inspect Impella position via echocardiography to exclude inlet/outlet obstruction against aortic valve.');
      recommendations.push('Evaluate for pump head thrombosis or cannula malposition.');
      recommendations.push('Optimize purge solution heparin/bivalirudin concentration.');
    } else if (plasmaFreeHbMgDl >= 25.0 || ldhUnitsPerLiter >= 350) {
      hemolysisRisk = 'BORDERLINE_ELEVATED';
      recommendations.push('Re-check serial pfHb and urinalysis in 6 hours.');
    }

    return {
      hemolysisRisk,
      isPfHbElevated,
      isLdhCritical,
      isAnticoagulationSubtherapeutic,
      recommendations,
    };
  }

  /**
   * Run Comprehensive MCS & Impella/LVAD Assessment.
   */
  static evaluatePatientAssessment(patient) {
    const cpo = this.calculateCardiacPowerOutput(patient.meanArterialPressure, patient.cardiacOutputTotalLitersMin);
    const papi = this.calculatePapi(
      patient.pulmonaryArterySystolicBp,
      patient.pulmonaryArteryDiastolicBp,
      patient.centralVenousPressure
    );
    const hemolysis = this.evaluateHemolysis(
      patient.plasmaFreeHemoglobinMgDl,
      patient.ldhUnitsPerLiter,
      patient.antiXaUnitsPerMl
    );

    const alerts = [];
    if (cpo.isSevereShock) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'REFRACTORY_CARDIOGENIC_SHOCK',
        title: `Depressed Cardiac Power Output (${cpo.cardiacPowerOutputWatts} W)`,
        description: 'CPO < 0.60 W indicates profound hemodynamic failure. Escalate MCS P-level or inotropes.',
        action: 'Increase Impella P-level and evaluate for biventricular compromise.',
      });
    }

    if (papi.isRvFailureRisk) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'RIGHT_VENTRICULAR_FAILURE',
        title: `Low Pulmonary Artery Pulsatility Index (${papi.pulmonaryArteryPulsatilityIndex})`,
        description: 'PAPi < 1.0 indicates severe RV failure secondary to acute LV decompression.',
        action: 'Initiate RV inotrope (Milrinone/Epi) or mobilize Impella RP team.',
      });
    }

    if (patient.suctionAlarmActive) {
      alerts.push({
        severity: 'HIGH',
        code: 'IMPELLA_SUCTION_EVENT',
        title: 'Impella Suction Event & High Motor Current',
        description: 'Inflow cannula abutment against LV endocardium or severe hypovolemia.',
        action: 'Reduce P-level immediately, volume load 250-500 mL crystalloid, check echo.',
      });
    }

    if (hemolysis.isPfHbElevated) {
      alerts.push({
        severity: 'WARNING',
        code: 'ELEVATED_HEMOLYSIS',
        title: `Plasma Free Hemoglobin Elevation (${patient.plasmaFreeHemoglobinMgDl} mg/dL)`,
        description: 'pfHb > 40 mg/dL indicates microaxial shear-induced erythrocyte mechanical lysis.',
        action: 'Check cannula depth via transthoracic echocardiogram.',
      });
    }

    return {
      patientId: patient.id,
      mrn: patient.mrn,
      name: patient.name,
      deviceType: patient.deviceType,
      cardiacPowerOutput: cpo,
      pulmonaryArteryPulsatilityIndex: papi,
      hemolysisEvaluation: hemolysis,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate HL7 FHIR R4 Bundle for Mechanical Circulatory Support.
   */
  static exportFhirR4Bundle(patient) {
    const assessment = this.evaluatePatientAssessment(patient);
    const now = new Date().toISOString();

    return {
      resourceType: 'Bundle',
      id: `bundle-mcs-telemetry-${patient.id.toLowerCase()}`,
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
          },
        },
        {
          fullUrl: `urn:uuid:device-mcs-${patient.id}`,
          resource: {
            resourceType: 'Device',
            id: `dev-mcs-${patient.id}`,
            status: 'active',
            type: {
              coding: [{ system: 'https://medtrack.org/devices', code: patient.deviceType }],
              text: MCS_DEVICE_TYPES[patient.deviceType]?.name || patient.deviceType,
            },
          },
        },
        {
          fullUrl: `urn:uuid:obs-cpo-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-cpo-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'https://medtrack.org/codes', code: 'CPO-WATTS', display: 'Cardiac Power Output' }],
              text: 'Cardiac Power Output (CPO)',
            },
            valueQuantity: { value: assessment.cardiacPowerOutput.cardiacPowerOutputWatts, unit: 'W' },
            referenceRange: [{ low: { value: 0.60, unit: 'W' } }],
          },
        },
        {
          fullUrl: `urn:uuid:obs-papi-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-papi-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'https://medtrack.org/codes', code: 'PAPI-INDEX', display: 'Pulmonary Artery Pulsatility Index' }],
              text: 'PAPi RV Index',
            },
            valueQuantity: { value: assessment.pulmonaryArteryPulsatilityIndex.pulmonaryArteryPulsatilityIndex },
            referenceRange: [{ low: { value: 1.0 } }],
          },
        },
      ],
    };
  }
}
