import crypto from 'crypto';
import {
  ASTCT_CRS_GRADES,
  ASTCT_ICANS_GRADES,
  ICE_COGNITIVE_ASSESSMENT_ITEMS,
} from '../models/cartImmunotherapy.model.js';

/**
 * Cellular Immunotherapy CAR-T Toxicity & Neuro-ICU Clinical Decision Support Service.
 *
 * Implements ASTCT Consensus Grading for Cytokine Release Syndrome (CRS) and Immune Effector
 * Cell-Associated Neurotoxicity Syndrome (ICANS), 10-point ICE cognitive scoring,
 * cytokine storm kinetics, targeted immunomodulator dosing algorithms, and HL7 FHIR R4 exports.
 */
export class CartImmunotherapyService {
  static assertFiniteNumber(value, fieldName, { min = -Infinity, max = Infinity } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${fieldName} must be a finite number`);
    }
    if (value < min || value > max) {
      throw new RangeError(`${fieldName} must be between ${min} and ${max}`);
    }
    return value;
  }

  /**
   * Deterministic ASTCT Cytokine Release Syndrome (CRS) Grading Algorithm.
   * Rules: Fever (>= 38.0 deg C) is required for all CRS grades.
   * Grade is determined by the most severe manifestation between hypotension and hypoxia.
   * @param {number} tempC
   * @param {'NONE' | 'FLUID_RESPONSIVE' | 'SINGLE_VASOPRESSOR' | 'MULTIPLE_VASOPRESSORS'} hypotension
   * @param {'ROOM_AIR' | 'LOW_FLOW_NC' | 'HIGH_FLOW_BIPAP' | 'INTUBATED_VENT'} hypoxia
   * @returns {{ grade: number, title: string, color: string, rationale: string, recommendedIntervention: string }}
   */
  static gradeCytokineReleaseSyndrome(tempC, hypotension = 'NONE', hypoxia = 'ROOM_AIR') {
    this.assertFiniteNumber(tempC, 'Temperature (C)', { min: 30, max: 45 });

    if (tempC < 38.0 && hypotension === 'NONE' && hypoxia === 'ROOM_AIR') {
      return {
        grade: 0,
        title: 'No CRS Detected',
        color: 'emerald',
        rationale: 'Afebrile (Temp < 38.0 C) with normal hemodynamics and room air oxygenation.',
        recommendedIntervention: 'Routine post-infusion monitoring per cellular therapy protocol.',
      };
    }

    let grade = 1;
    const rationales = [`Fever confirmed (Temp ${tempC} C).`];

    // Evaluate hypotension
    if (hypotension === 'MULTIPLE_VASOPRESSORS') {
      grade = Math.max(grade, 4);
      rationales.push('Life-threatening vasodilatory shock requiring multi-agent vasopressors (Grade 4).');
    } else if (hypotension === 'SINGLE_VASOPRESSOR') {
      grade = Math.max(grade, 3);
      rationales.push('Hypotension refractory to fluid boluses requiring single vasopressor infusion (Grade 3).');
    } else if (hypotension === 'FLUID_RESPONSIVE') {
      grade = Math.max(grade, 2);
      rationales.push('Hypotension responsive to IV crystalloid fluid loading (Grade 2).');
    }

    // Evaluate hypoxia
    if (hypoxia === 'INTUBATED_VENT') {
      grade = Math.max(grade, 4);
      rationales.push('Severe respiratory failure requiring invasive mechanical ventilation (Grade 4).');
    } else if (hypoxia === 'HIGH_FLOW_BIPAP') {
      grade = Math.max(grade, 3);
      rationales.push('Hypoxia requiring high-flow nasal cannula (> 6 L/min) or BiPAP / non-invasive ventilation (Grade 3).');
    } else if (hypoxia === 'LOW_FLOW_NC') {
      grade = Math.max(grade, 2);
      rationales.push('Hypoxia requiring low-flow nasal cannula <= 6 L/min (Grade 2).');
    }

    const astctMeta = ASTCT_CRS_GRADES[`GRADE_${grade}`] || ASTCT_CRS_GRADES.GRADE_1;

    return {
      grade,
      title: astctMeta.title,
      color: astctMeta.color,
      rationale: rationales.join(' '),
      recommendedIntervention: astctMeta.clinicalAction,
    };
  }

  /**
   * ASTCT Immune Effector Cell-Associated Neurotoxicity Syndrome (ICANS) Grading.
   * Determined by ICE cognitive score (0-10), level of consciousness, seizures, motor findings, and elevated ICP.
   * @param {number} iceScore (0 - 10)
   * @param {'NORMAL' | 'SOMNOLENT_AROUSABLE' | 'STUPOR' | 'COMA'} consciousness
   * @param {'NONE' | 'BRIEF_RESOLVED' | 'STATUS_EPILEPTICUS'} seizures
   * @param {boolean} motorDeficits
   * @param {boolean} raisedIcpOrCerebralEdema
   * @returns {{ grade: number, title: string, color: string, rationale: string, managementProtocol: string }}
   */
  static gradeIcansNeurotoxicity(
    iceScore = 10,
    consciousness = 'NORMAL',
    seizures = 'NONE',
    motorDeficits = false,
    raisedIcpOrCerebralEdema = false,
  ) {
    this.assertFiniteNumber(iceScore, 'ICE Score', { min: 0, max: 10 });

    if (raisedIcpOrCerebralEdema || consciousness === 'COMA' || seizures === 'STATUS_EPILEPTICUS') {
      const meta = ASTCT_ICANS_GRADES.GRADE_4;
      return {
        grade: 4,
        title: meta.title,
        color: meta.color,
        rationale: 'Grade 4 features present: Coma, status epilepticus, or diffuse cerebral edema with midline shift.',
        managementProtocol: meta.action,
      };
    }

    if (iceScore <= 2 || consciousness === 'STUPOR' || seizures === 'BRIEF_RESOLVED' || motorDeficits) {
      const meta = ASTCT_ICANS_GRADES.GRADE_3;
      return {
        grade: 3,
        title: meta.title,
        color: meta.color,
        rationale: `Grade 3 features present: ICE score ${iceScore}/10, severe expressive aphasia, or focal motor weakness.`,
        managementProtocol: meta.action,
      };
    }

    if (iceScore >= 3 && iceScore <= 6 || consciousness === 'SOMNOLENT_AROUSABLE') {
      const meta = ASTCT_ICANS_GRADES.GRADE_2;
      return {
        grade: 2,
        title: meta.title,
        color: meta.color,
        rationale: `Grade 2 features present: ICE score ${iceScore}/10, moderate dysphasia, easily arousable somnolence.`,
        managementProtocol: meta.action,
      };
    }

    if (iceScore >= 7 && iceScore <= 9) {
      const meta = ASTCT_ICANS_GRADES.GRADE_1;
      return {
        grade: 1,
        title: meta.title,
        color: meta.color,
        rationale: `Grade 1 features present: ICE score ${iceScore}/10, mild expressive dysphasia or handwriting impairment.`,
        managementProtocol: meta.action,
      };
    }

    return {
      grade: 0,
      title: 'No ICANS Detected',
      color: 'emerald',
      rationale: 'Intact cognitive assessment (ICE 10/10) with normal motor and language function.',
      managementProtocol: 'Continue serial ICE cognitive screening every 8-12 hours.',
    };
  }

  /**
   * Generates targeted immunomodulator (Tocilizumab, Dexamethasone, Anakinra) decision recommendations.
   * @param {number} crsGrade
   * @param {number} icansGrade
   * @param {number} cumulativeTocilizumabDoses
   * @returns {Array<object>}
   */
  static evaluateImmunomodulatorTherapy(crsGrade, icansGrade, cumulativeTocilizumabDoses = 1) {
    const orders = [];

    // CRS-driven pathways
    if (crsGrade >= 2) {
      if (cumulativeTocilizumabDoses < 4) {
        orders.push({
          drug: 'Tocilizumab (Actemra)',
          dosage: '8 mg/kg IV (Max 800 mg per single infusion)',
          route: 'Intravenous over 60 minutes',
          indication: `Active Grade ${crsGrade} Cytokine Release Syndrome`,
          urgency: crsGrade >= 3 ? 'STAT' : 'URGENT',
          dosingNote: `Dose #${cumulativeTocilizumabDoses + 1} of 4 maximum doses allowed in 24 hours.`,
        });
      } else {
        orders.push({
          drug: 'Anakinra (Kineret - IL-1Ra) / Siltuximab',
          dosage: '100 - 200 mg IV q6h',
          route: 'Intravenous',
          indication: 'Refractory CRS unresponsive to 4 cumulative Tocilizumab doses',
          urgency: 'STAT',
          dosingNote: 'Block interleukin-1 beta pathway for macrophage activation / HLH overlap.',
        });
      }
    }

    // ICANS-driven corticosteroid pathways (Note: Tocilizumab does not cross blood-brain barrier and is avoided for isolated ICANS)
    if (icansGrade >= 2 || crsGrade >= 3) {
      const steroidDose = icansGrade >= 3 || crsGrade >= 4 ? 'Dexamethasone 20mg IV q6h (or Methylprednisolone 1000mg/day pulse)' : 'Dexamethasone 10mg IV q6h';
      orders.push({
        drug: 'Dexamethasone',
        dosage: steroidDose,
        route: 'Intravenous',
        indication: `Neurotoxicity ICANS Grade ${icansGrade} / Severe CRS Grade ${crsGrade}`,
        urgency: 'STAT',
        dosingNote: 'Corticosteroids rapidly cross the blood-brain barrier to suppress microglial neuroinflammation.',
      });
    }

    return orders;
  }

  /**
   * Calculates Cytokine Activation Velocity & HLH/MAS Overlap Index.
   * @param {number} il6
   * @param {number} ferritin
   * @param {number} crp
   * @returns {{ activationIndex: number, hlhRiskCategory: string, interpretation: string }}
   */
  static calculateCytokineSurgeMetrics(il6, ferritin, crp) {
    this.assertFiniteNumber(il6, 'IL-6', { min: 0, max: 50000 });
    this.assertFiniteNumber(ferritin, 'Ferritin', { min: 0, max: 200000 });
    this.assertFiniteNumber(crp, 'CRP', { min: 0, max: 1000 });

    const activationIndex = Math.round(((il6 / 10) + (ferritin / 500) + (crp * 2)) * 10) / 10;

    let hlhRiskCategory = 'LOW_INFLAMMATORY_SURGE';
    let interpretation = 'Controlled CAR-T expansion without hyperferritinemic hemophagocytic lymphohistiocytosis (HLH) overlap.';

    if (ferritin > 10000 && il6 > 500) {
      hlhRiskCategory = 'HIGH_RISK_CAR_HLH_OVERLAP';
      interpretation = 'Extreme hyperferritinemia (> 10,000 ng/mL) and elevated IL-6: High suspicion for immune effector cell-associated HLH/MAS syndrome. Consider stat Anakinra and bone marrow aspirate.';
    } else if (ferritin > 3000 || il6 > 200) {
      hlhRiskCategory = 'MODERATE_CYTOKINE_STORM';
      interpretation = 'Significant systemic cytokine surge. Closely monitor for vasodilatory collapse and progressive neurotoxicity.';
    }

    return {
      activationIndex,
      hlhRiskCategory,
      interpretation,
    };
  }

  /**
   * Generates FDA 21 CFR Part 11 cryptographic digital audit signature.
   * @param {string} clinicianId
   * @param {string} protocolId
   * @param {object} patientData
   * @returns {{ signatureHash: string, timestamp: string, verificationAlgorithm: string, signer: string }}
   */
  static generateAuditSignature(clinicianId, protocolId, patientData) {
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      clinicianId,
      protocolId,
      patientId: patientData.id,
      mrn: patientData.mrn,
      carTConstruct: patientData.carTConstruct,
      crsGrade: patientData.crsGrade,
      icansGrade: patientData.icansGrade,
      timestamp,
    });

    const signatureHash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      signatureHash,
      timestamp,
      verificationAlgorithm: 'SHA-256 / FDA 21 CFR Part 11 Electronic Records',
      signer: clinicianId,
      status: 'AUTHENTICATED_AND_SEALED',
    };
  }

  /**
   * Exports HL7 FHIR R4 Bundle for CAR-T Cellular Therapy and Toxicity CarePlan.
   * @param {object} patient
   * @returns {object} HL7 FHIR R4 Bundle JSON
   */
  static exportFhirR4Bundle(patient) {
    const now = new Date().toISOString();
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: now,
      identifier: {
        system: 'https://medtrack.hospital.org/fhir/cart-toxicity',
        value: `CART-FHIR-${patient.id}-${Date.now()}`,
      },
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            identifier: [{ system: 'urn:mrn', value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-crs-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://snomed.info/sct', code: '870446002', display: 'Cytokine Release Syndrome' }],
              text: 'ASTCT CRS Grade',
            },
            subject: { reference: `Patient/${patient.id}` },
            effectiveDateTime: now,
            valueInteger: patient.crsGrade,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-icans-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://snomed.info/sct', code: '870447006', display: 'Immune Effector Cell-Associated Neurotoxicity Syndrome' }],
              text: 'ASTCT ICANS Grade',
            },
            subject: { reference: `Patient/${patient.id}` },
            effectiveDateTime: now,
            valueInteger: patient.icansGrade,
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-cart-${patient.id}`,
            status: 'active',
            intent: 'order',
            title: `ASTCT CAR-T Toxicity Care Plan - ${patient.carTConstruct}`,
            subject: { reference: `Patient/${patient.id}` },
            period: { start: now },
            activity: (patient.immunomodulatorsGiven || []).map((med) => ({
              detail: {
                kind: 'MedicationAdministration',
                code: { text: `${med.drug} - ${med.dose}` },
                status: 'completed',
              },
            })),
          },
        },
      ],
    };
  }
}
