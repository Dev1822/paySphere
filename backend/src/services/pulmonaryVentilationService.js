/**
 * Pulmonary Critical Care, ARDS & Advanced Mechanical Ventilation Service.
 *
 * Implements clinical decision algorithms for Berlin ARDS Classification,
 * ARDSNet Low Tidal Volume (LTVV) protocol targeting 4-8 mL/kg Predicted Body Weight,
 * Driving Pressure monitoring (ΔP < 14 cmH₂O target), Gattinoni Mechanical Power calculation,
 * Ventilatory Ratio (dead-space ventilation surrogate), RSBI weaning index, and HL7 FHIR R4 export.
 */

import {
  ARDS_SEVERITY_LEVELS,
  ASYNCHRONY_TYPES,
  PEEP_FIO2_TABLE,
  PRONE_POSITIONING_MILESTONES,
  PULMONARY_PATIENTS_DATABASE,
  VENTILATOR_MODES,
} from '../models/pulmonaryVentilation.model.js';

export class PulmonaryVentilationService {
  /**
   * Calculate Predicted Body Weight (PBW) in kg using the standard Devine Formula.
   *
   * Male:   50.0 + 0.91 * (heightCm - 152.4)
   * Female: 45.5 + 0.91 * (heightCm - 152.4)
   */
  static calculatePredictedBodyWeight(heightCm, sex) {
    if (!heightCm || heightCm < 100 || heightCm > 250) {
      throw new Error('Invalid height. Must be between 100 and 250 cm.');
    }

    const isMale = sex && sex.toUpperCase().startsWith('M');
    const baseWeight = isMale ? 50.0 : 45.5;
    const heightDiff = heightCm - 152.4;
    const pbw = baseWeight + 0.91 * heightDiff;

    return Math.round(Math.max(25.0, pbw) * 10) / 10;
  }

  /**
   * Calculate ARDSNet Target Tidal Volumes (4, 6, and 8 mL/kg PBW).
   */
  static calculateArdsNetTidalVolumeTargets(pbwKg) {
    if (!pbwKg || pbwKg <= 0) {
      throw new Error('PBW must be a positive number.');
    }

    return {
      pbwKg,
      target4mLkg: Math.round(pbwKg * 4),
      target6mLkg: Math.round(pbwKg * 6), // Standard initial ARDSNet target
      target8mLkg: Math.round(pbwKg * 8), // Upper ceiling for lung protection
      recommendedRange: `${Math.round(pbwKg * 4)} - ${Math.round(pbwKg * 8)} mL`,
    };
  }

  /**
   * Calculate Driving Pressure (ΔP).
   * Formula: ΔP = Pplat - PEEP
   * Benchmark: ΔP < 14 cmH₂O associated with improved survival (Amato et al., NEJM).
   */
  static calculateDrivingPressure(plateauPressure, peep) {
    if (plateauPressure === undefined || peep === undefined) {
      throw new Error('Plateau pressure and PEEP are required.');
    }

    const drivingPressure = Math.round((plateauPressure - peep) * 10) / 10;
    let tier = 'OPTIMAL';
    let interpretation = 'Driving pressure is within lung-protective target (< 14 cmH₂O).';

    if (drivingPressure > 18) {
      tier = 'CRITICAL_HIGH';
      interpretation = 'Severely elevated driving pressure (> 18 cmH₂O). High risk of barotrauma and VILI.';
    } else if (drivingPressure >= 14) {
      tier = 'ELEVATED_WARNING';
      interpretation = 'Elevated driving pressure (14-18 cmH₂O). Consider reducing tidal volume to 4-5 mL/kg PBW or optimizing PEEP.';
    }

    return {
      drivingPressure,
      target: '< 14 cmH₂O',
      tier,
      isProtective: drivingPressure < 14,
      interpretation,
    };
  }

  /**
   * Calculate Static Respiratory System Compliance (Cstat).
   * Formula: Cstat = Vt (mL) / (Pplat - PEEP)
   */
  static calculateStaticCompliance(tidalVolumeMl, plateauPressure, peep) {
    const deltaP = plateauPressure - peep;
    if (deltaP <= 0) {
      throw new Error('Plateau pressure must exceed PEEP to calculate static compliance.');
    }

    const cstat = Math.round((tidalVolumeMl / deltaP) * 10) / 10;
    let interpretation = 'Normal static compliance (> 50 mL/cmH₂O).';

    if (cstat < 20) {
      interpretation = 'Severely stiff / baby lung (Cstat < 20 mL/cmH₂O). Characteristic of severe consolidation or fibroproliferative ARDS.';
    } else if (cstat < 35) {
      interpretation = 'Significantly reduced compliance (20-35 mL/cmH₂O). Typical for moderate ARDS.';
    } else if (cstat < 50) {
      interpretation = 'Mildly reduced compliance (35-50 mL/cmH₂O).';
    }

    return {
      staticCompliance: cstat,
      unit: 'mL/cmH₂O',
      interpretation,
    };
  }

  /**
   * Calculate Gattinoni Mechanical Power of Ventilation.
   * Simplified Clinical Formula for Volume Control:
   * MP (J/min) = 0.098 * RR * Vt(L) * [Ppeak - 0.5 * (Pplat - PEEP)]
   *
   * Threshold: MP > 17 J/min associated with lung injury; MP > 27 J/min high mortality.
   */
  static calculateMechanicalPower(respiratoryRate, tidalVolumeMl, peakPressure, plateauPressure, peep) {
    if (!respiratoryRate || !tidalVolumeMl || !peakPressure || !plateauPressure) {
      throw new Error('Missing parameters for mechanical power calculation.');
    }

    const vtLiters = tidalVolumeMl / 1000.0;
    const deltaP = plateauPressure - peep;
    const mechanicalPower = 0.098 * respiratoryRate * vtLiters * (peakPressure - 0.5 * deltaP);
    const roundedPower = Math.round(mechanicalPower * 10) / 10;

    let riskLevel = 'LOW_VILI_RISK';
    let interpretation = 'Mechanical power is within safe range (< 17 J/min).';

    if (roundedPower >= 27.0) {
      riskLevel = 'CRITICAL_VILI_RISK';
      interpretation = 'Excessive mechanical power (≥ 27 J/min). High probability of ventilator-induced lung injury (VILI) and increased mortality.';
    } else if (roundedPower >= 17.0) {
      riskLevel = 'MODERATE_VILI_RISK';
      interpretation = 'Moderate mechanical power (17-27 J/min). Recommend re-evaluating RR and tidal volume.';
    }

    return {
      mechanicalPowerJoulesMin: roundedPower,
      riskLevel,
      thresholdLowRisk: '< 17.0 J/min',
      thresholdHighRisk: '≥ 27.0 J/min',
      interpretation,
    };
  }

  /**
   * Calculate Ventilatory Ratio (VR).
   * Surrogate for pulmonary dead space fraction (Vd/Vt).
   * Formula: VR = [Minute Ventilation (mL/min) * PaCO₂ (mmHg)] / [Predicted MV (mL/min) * 37.5]
   * where Predicted MV = PBW (kg) * 100 mL/kg/min
   *
   * Normal VR ≈ 1.0. VR > 1.5 indicates significant dead-space ventilation impairment and pulmonary vascular thrombosis/injury.
   */
  static calculateVentilatoryRatio(minuteVentilationLiters, paco2, pbwKg) {
    if (!minuteVentilationLiters || !paco2 || !pbwKg) {
      throw new Error('Minute ventilation, PaCO2, and PBW are required.');
    }

    const minuteVentilationMl = minuteVentilationLiters * 1000.0;
    const predictedMvMl = pbwKg * 100.0;
    const vr = (minuteVentilationMl * paco2) / (predictedMvMl * 37.5);
    const roundedVr = Math.round(vr * 100) / 100;

    let interpretation = 'Normal dead space fraction (VR ~ 1.0).';
    if (roundedVr > 2.0) {
      interpretation = 'Severely elevated dead-space fraction (VR > 2.0). Marked pulmonary microvascular occlusion or severe alveolar hyperinflation.';
    } else if (roundedVr > 1.5) {
      interpretation = 'Moderately increased dead-space ventilation (VR 1.5 - 2.0).';
    }

    return {
      ventilatoryRatio: roundedVr,
      isElevated: roundedVr > 1.5,
      interpretation,
    };
  }

  /**
   * Calculate Rapid Shallow Breathing Index (RSBI).
   * Formula: RSBI = Respiratory Rate (breaths/min) / Tidal Volume (Liters)
   *
   * Threshold: RSBI < 105 breaths/min/L indicates high probability of successful extubation during SBT.
   */
  static calculateRsbi(spontaneousRr, spontaneousVtMl) {
    if (!spontaneousRr || !spontaneousVtMl) {
      throw new Error('Spontaneous RR and tidal volume are required.');
    }

    const vtLiters = spontaneousVtMl / 1000.0;
    const rsbi = Math.round(spontaneousRr / vtLiters);

    const isFavorable = rsbi < 105;
    const interpretation = isFavorable
      ? `Favorable weaning index (RSBI = ${rsbi} < 105). Patient exhibits adequate breathing economy for Spontaneous Breathing Trial (SBT).`
      : `Unfavorable weaning index (RSBI = ${rsbi} ≥ 105). Patient exhibits rapid shallow breathing; high risk of post-extubation failure.`;

    return {
      rsbi,
      isFavorable,
      threshold: '< 105 breaths/min/L',
      interpretation,
    };
  }

  /**
   * Evaluate Berlin Definition Criteria for ARDS.
   */
  static evaluateBerlinArdsCriteria(pao2, fio2, peep, bilateralInfiltrates = true, notCardiogenic = true) {
    if (!pao2 || !fio2) {
      throw new Error('PaO2 and FiO2 are required.');
    }

    const pfRatio = Math.round((pao2 / fio2) * 10) / 10;
    const meetsPeepCriteria = peep >= 5;

    let classification = ARDS_SEVERITY_LEVELS.WEANING_CANDIDATE;

    if (bilateralInfiltrates && notCardiogenic && meetsPeepCriteria) {
      if (pfRatio <= 100) {
        classification = ARDS_SEVERITY_LEVELS.SEVERE_ARDS;
      } else if (pfRatio <= 200) {
        classification = ARDS_SEVERITY_LEVELS.MODERATE_ARDS;
      } else if (pfRatio <= 300) {
        classification = ARDS_SEVERITY_LEVELS.MILD_ARDS;
      } else {
        classification = ARDS_SEVERITY_LEVELS.AT_RISK_LUNG_INJURY;
      }
    } else if (pfRatio <= 300) {
      classification = ARDS_SEVERITY_LEVELS.AT_RISK_LUNG_INJURY;
    }

    const recommendedEscalations = [];
    if (classification.id === 'SEVERE_ARDS') {
      recommendedEscalations.push('Initiate PROSEVA Prone Positioning (≥ 16h/session)');
      recommendedEscalations.push('Continuous Neuromuscular Blockade Infusion (Cisatracurium 48h)');
      recommendedEscalations.push('Consider Inhaled Pulmonary Vasodilator (Epoprostenol / iNO)');
      recommendedEscalations.push('Extracorporeal Membrane Oxygenation (VV-ECMO) Consult if P/F < 80 for > 6h');
    } else if (classification.id === 'MODERATE_ARDS') {
      recommendedEscalations.push('Titrate PEEP according to Higher-PEEP / Lower-FiO2 ARDSNet matrix');
      recommendedEscalations.push('Screen for Prone Positioning if P/F remains < 150 despite PEEP optimization');
      recommendedEscalations.push('Ensure strict lung protection (6 mL/kg PBW, ΔP < 14 cmH₂O)');
    } else if (classification.id === 'MILD_ARDS') {
      recommendedEscalations.push('Maintain ARDSNet low tidal volume ventilation');
      recommendedEscalations.push('Conservative fluid management strategy (FACTT protocol)');
    }

    return {
      pao2Fio2Ratio: pfRatio,
      peep,
      meetsPeepCriteria,
      classification,
      recommendedEscalations,
    };
  }

  /**
   * Run Comprehensive Pulmonary & Ventilator Assessment.
   */
  static evaluatePatientAssessment(patient) {
    const pbwKg = this.calculatePredictedBodyWeight(patient.heightCm, patient.sex);
    const ltvvTargets = this.calculateArdsNetTidalVolumeTargets(pbwKg);
    const drivingPres = this.calculateDrivingPressure(patient.plateauPressure, patient.setPeep);
    const staticComp = this.calculateStaticCompliance(patient.measuredVtMl, patient.plateauPressure, patient.setPeep);
    const mechPower = this.calculateMechanicalPower(
      patient.measuredRr,
      patient.measuredVtMl,
      patient.measuredPeakPressure,
      patient.plateauPressure,
      patient.setPeep
    );
    const minuteVentLiters = (patient.measuredRr * patient.measuredVtMl) / 1000.0;
    const ventRatio = this.calculateVentilatoryRatio(minuteVentLiters, patient.paco2, pbwKg);
    const ardsEval = this.evaluateBerlinArdsCriteria(patient.pao2, patient.fio2, patient.setPeep);
    const currentVtPerKgPbw = Math.round((patient.measuredVtMl / pbwKg) * 10) / 10;

    const alerts = [];
    if (drivingPres.drivingPressure > 14) {
      alerts.push({
        severity: drivingPres.drivingPressure > 18 ? 'CRITICAL' : 'WARNING',
        code: 'HIGH_DRIVING_PRESSURE',
        title: `High Driving Pressure (${drivingPres.drivingPressure} cmH₂O)`,
        description: `Exceeds lung-protective threshold (< 14 cmH₂O). Associated with excess cyclic alveolar strain.`,
        action: 'Decrease tidal volume toward 4-5 mL/kg PBW or perform decremental PEEP titration.',
      });
    }

    if (patient.plateauPressure > 30) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'HIGH_PLATEAU_PRESSURE',
        title: `Elevated Plateau Pressure (${patient.plateauPressure} cmH₂O)`,
        description: 'Exceeds ARDSNet safety limit (Pplat ≤ 30 cmH₂O). Severe risk of barotrauma.',
        action: 'Reduce tidal volume in 1 mL/kg steps down to 4 mL/kg PBW.',
      });
    }

    if (mechPower.mechanicalPowerJoulesMin >= 27.0) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'CRITICAL_MECHANICAL_POWER',
        title: `Critical Mechanical Power (${mechPower.mechanicalPowerJoulesMin} J/min)`,
        description: 'Energy delivered to lung parenchyma exceeds safe physical threshold (≥ 27 J/min).',
        action: 'Reduce respiratory rate and tidal volume; consider permissive hypercapnia.',
      });
    }

    if (patient.asynchronyIndexPct > 10) {
      alerts.push({
        severity: 'WARNING',
        code: 'SEVERE_ASYNCHRONY',
        title: `Severe Patient-Ventilator Asynchrony (${patient.asynchronyIndexPct}%)`,
        description: `Active asynchrony (${patient.primaryAsynchrony}) causing breath stacking or work of breathing spike.`,
        action: ASYNCHRONY_TYPES[patient.primaryAsynchrony]?.action || 'Optimize ventilator synchrony settings.',
      });
    }

    return {
      patientId: patient.id,
      mrn: patient.mrn,
      name: patient.name,
      pbwKg,
      currentVtPerKgPbw,
      ltvvTargets,
      drivingPressure: drivingPres,
      staticCompliance: staticComp,
      mechanicalPower: mechPower,
      ventilatoryRatio: ventRatio,
      ardsEvaluation: ardsEval,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate HL7 FHIR R4 Bundle for Mechanical Ventilation & ARDS Observation.
   */
  static exportFhirR4Bundle(patient) {
    const assessment = this.evaluatePatientAssessment(patient);
    const now = new Date().toISOString();

    return {
      resourceType: 'Bundle',
      id: `bundle-pulmonary-ards-${patient.id.toLowerCase()}`,
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
            extension: [
              { url: 'http://hl7.org/fhir/StructureDefinition/patient-pbw', valueDecimal: assessment.pbwKg },
              { url: 'http://hl7.org/fhir/StructureDefinition/patient-height', valueDecimal: patient.heightCm },
            ],
          },
        },
        {
          fullUrl: `urn:uuid:obs-pao2-fio2-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-pf-${patient.id}`,
            status: 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
            code: {
              coding: [{ system: 'http://loinc.org', code: '50983-6', display: 'Oxygen/Inspired gas setting [Volume fraction] ratio in Arterial blood' }],
              text: 'PaO2/FiO2 Ratio (Berlin ARDS)',
            },
            valueQuantity: { value: patient.pao2Fio2Ratio, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
            interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: assessment.ardsEvaluation.classification.id }] }],
          },
        },
        {
          fullUrl: `urn:uuid:obs-driving-pressure-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-dp-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '76527-1', display: 'Driving pressure Respiratory system' }],
              text: 'Ventilator Driving Pressure (Pplat - PEEP)',
            },
            valueQuantity: { value: assessment.drivingPressure.drivingPressure, unit: 'cmH2O', system: 'http://unitsofmeasure.org', code: 'cm[H2O]' },
            referenceRange: [{ high: { value: 14, unit: 'cmH2O' } }],
          },
        },
        {
          fullUrl: `urn:uuid:obs-mechanical-power-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-mp-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'https://medtrack.org/codes', code: 'VENT-MECH-POWER', display: 'Mechanical Power of Ventilation (Gattinoni)' }],
              text: 'Mechanical Power',
            },
            valueQuantity: { value: assessment.mechanicalPower.mechanicalPowerJoulesMin, unit: 'J/min' },
            referenceRange: [{ high: { value: 17, unit: 'J/min' } }],
          },
        },
        {
          fullUrl: `urn:uuid:obs-static-compliance-${patient.id}`,
          resource: {
            resourceType: 'Observation',
            id: `obs-cstat-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '19992-7', display: 'Compliance Respiratory system.static' }],
              text: 'Static Respiratory System Compliance (Cstat)',
            },
            valueQuantity: { value: assessment.staticCompliance.staticCompliance, unit: 'mL/cmH2O' },
          },
        },
      ],
    };
  }
}
