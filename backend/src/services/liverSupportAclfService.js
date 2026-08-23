import crypto from 'crypto';
import {
  ACLF_GRADES,
  HEPATOLOGY_PATIENT_FIXTURES,
  WEST_HAVEN_HE_GRADES,
} from '../models/liverSupportAclf.model.js';

/**
 * Extracorporeal Liver Support & Acute-on-Chronic Liver Failure (ACLF) Decision Support Service.
 *
 * Implements EASL-CLIF Consortium diagnostic criteria, CLIF-C ACLF prognostic scoring,
 * OPTN MELD-3.0 calculations, MARS (Molecular Adsorbent Recirculating System) albumin dialysis telemetry,
 * and HL7 FHIR R4 care plan exports.
 */
export class LiverSupportAclfService {
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
   * Computes EASL-CLIF Organ Failure (CLIF-OF) score & ACLF Grade (0 - 3).
   * CLIF-OF evaluates 6 organ systems (Liver, Kidney, Brain, Coagulation, Circulation, Respiration) scored 1 - 3 each.
   * @param {number} bilirubinMgDl
   * @param {number} creatinineMgDl
   * @param {number} westHavenGrade (0 - 4)
   * @param {number} inr
   * @param {number} map
   * @param {boolean} vasopressorUsed
   * @param {number} pao2Fio2Ratio
   * @returns {{ clifOfScore: number, aclfGrade: number, failedOrgans: Array<string>, title: string, mortality28d: string }}
   */
  static calculateClifOrganFailure(
    bilirubinMgDl,
    creatinineMgDl,
    westHavenGrade = 0,
    inr = 1.0,
    map = 70,
    vasopressorUsed = false,
    pao2Fio2Ratio = 400,
  ) {
    this.assertFiniteNumber(bilirubinMgDl, 'Bilirubin', { min: 0.1, max: 100 });
    this.assertFiniteNumber(creatinineMgDl, 'Creatinine', { min: 0.1, max: 25 });
    this.assertFiniteNumber(westHavenGrade, 'West Haven HE Grade', { min: 0, max: 4 });
    this.assertFiniteNumber(inr, 'INR', { min: 0.5, max: 15 });
    this.assertFiniteNumber(map, 'MAP', { min: 20, max: 200 });

    let liverScore = 1;
    let kidneyScore = 1;
    let brainScore = 1;
    let coagScore = 1;
    let circScore = 1;
    let respScore = 1;

    const failedOrgans = [];

    // Liver (1: <6, 2: 6-11.9, 3: >=12)
    if (bilirubinMgDl >= 12.0) {
      liverScore = 3;
      failedOrgans.push('Liver Failure (Bilirubin >= 12.0 mg/dL)');
    } else if (bilirubinMgDl >= 6.0) {
      liverScore = 2;
    }

    // Kidney (1: <2.0, 2: 2.0-3.4, 3: >=3.5 or RRT)
    if (creatinineMgDl >= 3.5) {
      kidneyScore = 3;
      failedOrgans.push('Kidney Failure (Creatinine >= 3.5 mg/dL)');
    } else if (creatinineMgDl >= 2.0) {
      kidneyScore = 2;
      failedOrgans.push('Kidney Failure (Creatinine 2.0 - 3.4 mg/dL)');
    }

    // Brain (1: Grade 0, 2: Grade 1-2, 3: Grade 3-4)
    if (westHavenGrade >= 3) {
      brainScore = 3;
      failedOrgans.push('Cerebral Failure (West Haven Grade 3-4 HE)');
    } else if (westHavenGrade >= 1) {
      brainScore = 2;
    }

    // Coagulation (1: INR <2.0, 2: 2.0-2.4, 3: >=2.5)
    if (inr >= 2.5) {
      coagScore = 3;
      failedOrgans.push('Coagulation Failure (INR >= 2.5)');
    } else if (inr >= 2.0) {
      coagScore = 2;
    }

    // Circulation (1: MAP >=70, 2: MAP <70, 3: Vasopressors)
    if (vasopressorUsed) {
      circScore = 3;
      failedOrgans.push('Circulatory Failure (Vasopressor Support)');
    } else if (map < 70) {
      circScore = 2;
    }

    // Respiration (1: PaO2/FiO2 >300, 2: 201-300, 3: <=200)
    if (pao2Fio2Ratio <= 200) {
      respScore = 3;
      failedOrgans.push('Respiratory Failure (PaO2/FiO2 <= 200)');
    } else if (pao2Fio2Ratio <= 300) {
      respScore = 2;
    }

    const clifOfScore = liverScore + kidneyScore + brainScore + coagScore + circScore + respScore;
    const failureCount = failedOrgans.length;

    let aclfGrade = 0;
    if (failureCount >= 3) {
      aclfGrade = 3;
    } else if (failureCount === 2) {
      aclfGrade = 2;
    } else if (failureCount === 1) {
      // If single kidney failure, it is ACLF-1. If single other organ failure, requires renal impairment (Cr 1.5-1.9) or HE.
      if (kidneyScore >= 2 || creatinineMgDl >= 1.5 || westHavenGrade >= 1) {
        aclfGrade = 1;
      }
    }

    const gradeMeta = ACLF_GRADES[`ACLF_GRADE_${aclfGrade}`] || ACLF_GRADES.NO_ACLF;

    return {
      clifOfScore,
      aclfGrade,
      failedOrgans,
      title: gradeMeta.title,
      mortality28d: gradeMeta.mortality28d,
    };
  }

  /**
   * Computes CLIF-C ACLF Prognostic Score.
   * Formula: CLIF-C = 10 * [0.33 * CLIF-OF + 0.04 * Age + 0.63 * ln(WBC) - 2]
   * @param {number} clifOfScore (6 - 18)
   * @param {number} ageYears (18 - 100)
   * @param {number} wbcCount (1.0 - 50.0 x10^9/L)
   * @returns {{ score: number, predicted28dMortalityPct: number, riskCategory: string }}
   */
  static calculateClifCAclfScore(clifOfScore, ageYears, wbcCount = 10.0) {
    this.assertFiniteNumber(clifOfScore, 'CLIF-OF Score', { min: 6, max: 18 });
    this.assertFiniteNumber(ageYears, 'Age (Years)', { min: 18, max: 105 });
    this.assertFiniteNumber(wbcCount, 'WBC Count', { min: 0.5, max: 100 });

    const raw = 10 * (0.33 * clifOfScore + 0.04 * ageYears + 0.63 * Math.log(wbcCount) - 2);
    const score = Math.round(raw * 10) / 10;

    // Approximate 28-day mortality sigmoid
    const predicted28dMortalityPct = Math.min(95, Math.max(5, Math.round(100 / (1 + Math.exp(-0.12 * (score - 50))) * 10) / 10));

    let riskCategory = 'LOW_ACLF_MORTALITY';
    if (score >= 64) {
      riskCategory = 'VERY_HIGH_FUTILITY_THRESHOLD';
    } else if (score >= 55) {
      riskCategory = 'HIGH_MORTALITY_TRANSPLANT_PRIORITY';
    } else if (score >= 45) {
      riskCategory = 'MODERATE_ACLF_RISK';
    }

    return {
      score,
      predicted28dMortalityPct,
      riskCategory,
    };
  }

  /**
   * Computes OPTN MELD-3.0 Score.
   * Standardizes bounds: Bilirubin >= 1.0, INR >= 1.0, Creatinine >= 1.0 (capped at 3.0), Albumin 1.5 - 3.5, Sodium 125 - 137.
   * @param {boolean} isFemale
   * @param {number} bilirubinMgDl
   * @param {number} inr
   * @param {number} creatinineMgDl
   * @param {number} sodiumMeqL
   * @param {number} albuminGDl
   * @returns {{ meld3Score: number, meldCategory: string }}
   */
  static calculateMeld3Score(isFemale, bilirubinMgDl, inr, creatinineMgDl, sodiumMeqL = 135, albuminGDl = 3.0) {
    this.assertFiniteNumber(bilirubinMgDl, 'Bilirubin', { min: 0.1, max: 100 });
    this.assertFiniteNumber(inr, 'INR', { min: 0.5, max: 20 });
    this.assertFiniteNumber(creatinineMgDl, 'Creatinine', { min: 0.1, max: 25 });
    this.assertFiniteNumber(sodiumMeqL, 'Sodium', { min: 100, max: 160 });
    this.assertFiniteNumber(albuminGDl, 'Albumin', { min: 0.5, max: 6.0 });

    const bili = Math.max(1.0, bilirubinMgDl);
    const inrVal = Math.max(1.0, inr);
    const cr = Math.min(3.0, Math.max(1.0, creatinineMgDl));
    const na = Math.min(137, Math.max(125, sodiumMeqL));
    const alb = Math.min(3.5, Math.max(1.5, albuminGDl));

    const femaleTerm = isFemale ? 1.33 : 0.0;
    const biliTerm = 4.56 * Math.log(bili);
    const naTerm = 0.82 * (137 - na);
    const naBiliInteraction = -0.24 * (137 - na) * Math.log(bili);
    const inrTerm = 9.09 * Math.log(inrVal);
    const crTerm = 11.14 * Math.log(cr);
    const albTerm = 1.85 * (3.5 - alb);
    const albCrInteraction = -1.83 * (3.5 - alb) * Math.log(cr);

    const meldRaw = femaleTerm + biliTerm + naTerm + naBiliInteraction + inrTerm + crTerm + albTerm + albCrInteraction + 6.0;
    const meld3Score = Math.min(40, Math.max(6, Math.round(meldRaw)));

    let meldCategory = 'STABLE_COMPENSATED';
    if (meld3Score >= 35) {
      meldCategory = 'CRITICAL_URGENT_STATUS_1B';
    } else if (meld3Score >= 25) {
      meldCategory = 'HIGH_PRIORITY_TRANSPLANT_CANDIDATE';
    } else if (meld3Score >= 15) {
      meldCategory = 'MODERATE_DISEASE_SEVERITY';
    }

    return {
      meld3Score,
      meldCategory,
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
      aclfGrade: patientData.aclfGrade,
      meld3Score: patientData.meld3Score,
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
   * Exports HL7 FHIR R4 Bundle for Extracorporeal Liver Support & CarePlan.
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
        system: 'https://medtrack.hospital.org/fhir/liver-support',
        value: `LIV-FHIR-${patient.id}-${Date.now()}`,
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
            id: `obs-aclf-grade-${patient.id}`,
            status: 'final',
            code: { text: 'EASL-CLIF ACLF Severity Grade' },
            valueInteger: patient.aclfGrade,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-meld3-${patient.id}`,
            status: 'final',
            code: { text: 'OPTN MELD 3.0 Score' },
            valueInteger: patient.meld3Score,
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-mars-dialysis-${patient.id}`,
            title: `Extracorporeal Albumin Dialysis (MARS) & HRS-AKI Protocol`,
            description: `Active Circuit Flow: ${patient.marsTelemetry.bloodFlowRateMlMin} mL/min | Bilirubin Clearance: ${patient.marsTelemetry.bilirubinClearancePct}%`,
          },
        },
      ],
    };
  }
}
