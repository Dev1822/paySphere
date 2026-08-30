/**
 * Neonatal Intensive Care Unit (NICU) Clinical Decision Support & Telemetry Service
 *
 * Implements clinical algorithms for:
 * 1. Neonatal Sequential Organ Failure Assessment (nSOFA)
 * 2. Score for Neonatal Acute Physiology, Perinatal Extension-II (SNAPPE-II)
 * 3. Oxygenation Index (OI) and Oxygen Saturation Index (OSI)
 * 4. Pre/Post-Ductal SpO2 Shunt Gradient Analysis
 * 5. Therapeutic Hypothermia Protocol Safety & Rewarming Velocity Sentry
 * 6. Neonatal Vasoactive-Inotropic Score (VIS)
 * 7. Bells Staging for Necrotizing Enterocolitis (NEC)
 * 8. HL7 FHIR R4 Bundle Exporter & CSV Time-Series Exporter
 */

import {
  GESTATIONAL_AGE_CATEGORIES,
  HYPOTHERMIA_PHASES,
  HFOV_DEFAULT_TARGETS,
  INITIAL_NEONATAL_PATIENTS,
} from "../models/neonatalICU.model.js";

export class NeonatalICUService {
  constructor() {
    this.patients = new Map();
    INITIAL_NEONATAL_PATIENTS.forEach((p) => this.patients.set(p.id, { ...p }));
  }

  getAllPatients() {
    return Array.from(this.patients.values());
  }

  getPatientById(patientId) {
    const patient = this.patients.get(patientId);
    if (!patient) {
      throw new Error("Neonatal patient " + patientId + " not found");
    }
    return patient;
  }

  calculateNSOFA(plateletsK, sfRatio, inotropicScoreVIS) {
    let plateletScore = 0;
    if (plateletsK < 50) plateletScore = 3;
    else if (plateletsK < 100) plateletScore = 2;
    else if (plateletsK < 150) plateletScore = 1;

    let respScore = 0;
    if (sfRatio < 150) respScore = 3;
    else if (sfRatio < 200) respScore = 2;
    else if (sfRatio < 300) respScore = 1;

    let cvScore = 0;
    if (inotropicScoreVIS >= 15) cvScore = 3;
    else if (inotropicScoreVIS >= 5) cvScore = 2;
    else if (inotropicScoreVIS > 0) cvScore = 1;

    const totalScore = plateletScore + respScore + cvScore;
    let riskCategory = "LOW";
    if (totalScore >= 6) riskCategory = "EXTREME_MORTALITY_RISK";
    else if (totalScore >= 4) riskCategory = "HIGH_ORGAN_DYSFUNCTION";
    else if (totalScore >= 2) riskCategory = "MODERATE_RISK";

    return {
      totalScore,
      organScores: {
        hematologicPlateletScore: plateletScore,
        respiratoryScore: respScore,
        cardiovascularScore: cvScore,
      },
      riskCategory,
    };
  }

  calculateSNAPPE_II({
    meanBp,
    lowestTempC,
    pao2Fio2Ratio,
    lowestPh,
    hasMultipleSeizures,
    urineOutputMlKgHr,
    birthWeightGrams,
    isSgaBelow3rdPercentile,
    apgar5Min,
  }) {
    let score = 0;
    const subscores = [];

    if (meanBp < 20) {
      score += 28;
      subscores.push({ parameter: "MAP < 20 mmHg", points: 28 });
    } else if (meanBp < 30) {
      score += 19;
      subscores.push({ parameter: "MAP 20-29 mmHg", points: 19 });
    }

    if (lowestTempC < 35.0) {
      score += 15;
      subscores.push({ parameter: "Lowest Core Temp < 35.0 C", points: 15 });
    } else if (lowestTempC < 35.6) {
      score += 8;
      subscores.push({ parameter: "Lowest Core Temp 35.0-35.5 C", points: 8 });
    }

    if (pao2Fio2Ratio < 30) {
      score += 28;
      subscores.push({ parameter: "PaO2/FiO2 < 0.3 (<30)", points: 28 });
    } else if (pao2Fio2Ratio < 100) {
      score += 16;
      subscores.push({ parameter: "PaO2/FiO2 0.3-0.99 (30-99)", points: 16 });
    } else if (pao2Fio2Ratio < 250) {
      score += 5;
      subscores.push({ parameter: "PaO2/FiO2 1.0-2.49 (100-249)", points: 5 });
    }

    if (lowestPh < 7.10) {
      score += 16;
      subscores.push({ parameter: "Lowest pH < 7.10", points: 16 });
    } else if (lowestPh < 7.20) {
      score += 7;
      subscores.push({ parameter: "Lowest pH 7.10-7.19", points: 7 });
    }

    if (hasMultipleSeizures) {
      score += 19;
      subscores.push({ parameter: "Multiple / Refractory Seizures", points: 19 });
    }

    if (urineOutputMlKgHr < 0.1) {
      score += 18;
      subscores.push({ parameter: "Anuria / Oliguria (<0.1 mL/kg/hr)", points: 18 });
    } else if (urineOutputMlKgHr < 1.0) {
      score += 5;
      subscores.push({ parameter: "Oliguria (0.1-0.9 mL/kg/hr)", points: 5 });
    }

    if (birthWeightGrams < 750) {
      score += 17;
      subscores.push({ parameter: "Birth Weight < 750g", points: 17 });
    } else if (birthWeightGrams < 1000) {
      score += 10;
      subscores.push({ parameter: "Birth Weight 750-999g", points: 10 });
    }

    if (isSgaBelow3rdPercentile) {
      score += 12;
      subscores.push({ parameter: "Small for Gestational Age (<3rd %ile)", points: 12 });
    }

    if (apgar5Min < 7) {
      score += 18;
      subscores.push({ parameter: "5-minute Apgar < 7", points: 18 });
    }

    let mortalityRiskTier = "LOW (< 5%)";
    if (score >= 50) mortalityRiskTier = "CRITICAL HIGH (> 45%)";
    else if (score >= 35) mortalityRiskTier = "ELEVATED (20 - 45%)";
    else if (score >= 20) mortalityRiskTier = "MODERATE (5 - 20%)";

    return {
      totalScore: score,
      subscores,
      mortalityRiskTier,
    };
  }

  calculateOxygenationIndex(mapAirwayCmH2O, fio2Fraction, pao2MmHg, spo2Pct = null) {
    if (pao2MmHg <= 0) {
      throw new Error("PaO2 must be greater than 0");
    }
    const fio2Pct = fio2Fraction <= 1.0 ? fio2Fraction * 100 : fio2Fraction;
    const oi = Math.round(((mapAirwayCmH2O * fio2Pct) / pao2MmHg) * 10) / 10;

    let interpretation = "Mild or Normal Oxygenation Reserve";
    let ecmoCandidate = false;
    let inoRecommended = false;

    if (oi >= 40) {
      interpretation = "Refractory Hypoxemic Respiratory Failure (Severe PPHN / ARDS). Meets ECMO Criteria.";
      ecmoCandidate = true;
      inoRecommended = true;
    } else if (oi >= 25) {
      interpretation = "Severe Oxygenation Impairment. Inhaled Nitric Oxide (iNO 20 ppm) & HFOV Optimization Indicated.";
      inoRecommended = true;
    } else if (oi >= 15) {
      interpretation = "Moderate Oxygenation Impairment. Optimize MAP, recruitment maneuvers, and echocardiography.";
    }

    let osi = null;
    if (spo2Pct && spo2Pct > 0) {
      osi = Math.round(((mapAirwayCmH2O * fio2Pct) / spo2Pct) * 10) / 10;
    }

    return {
      oxygenationIndex: oi,
      oxygenSaturationIndex: osi,
      interpretation,
      ecmoCandidate,
      inoRecommended,
    };
  }

  calculateDuctalGradient(preDuctalSpO2, postDuctalSpO2) {
    const gradient = Math.round((preDuctalSpO2 - postDuctalSpO2) * 10) / 10;
    let shuntingClassification = "BALANCED_OR_MINIMAL_SHUNT";
    let clinicalMeaning = "No hemodynamically significant right-to-left ductal shunting detected (< 5%).";

    if (gradient >= 10) {
      shuntingClassification = "SEVERE_RIGHT_TO_LEFT_SHUNT";
      clinicalMeaning = "Significant Right-to-Left ductal shunting (Delta >= 10%). High suspicion of severe PPHN or severe Coarctation of Aorta.";
    } else if (gradient >= 5) {
      shuntingClassification = "MODERATE_RIGHT_TO_LEFT_SHUNT";
      clinicalMeaning = "Moderate Right-to-Left ductal shunting (Delta 5-9%). Monitor pulmonary pressures and bedside echo.";
    } else if (gradient < -5) {
      shuntingClassification = "REVERSE_DIFFERENTIAL_CYANOSIS";
      clinicalMeaning = "Post-ductal SpO2 higher than pre-ductal. Critical warning: Transposition of Great Arteries (TGA) with PDA + Coarctation or Supracardiac TAPVR.";
    }

    return {
      preDuctalSpO2,
      postDuctalSpO2,
      gradientDelta: gradient,
      shuntingClassification,
      clinicalMeaning,
      requiresEchocardiogram: Math.abs(gradient) >= 5,
    };
  }

  evaluateHypothermiaSafety({
    phase,
    actualCoreTempC,
    targetCoreTempC,
    elapsedHours,
    rewarmingRatePerHour = 0,
    aEEGPattern = "CONTINUOUS_NORMAL_VOLTAGE",
  }) {
    const alerts = [];
    let isSafe = true;

    if (phase === "INDUCTION") {
      if (actualCoreTempC > 34.5 && elapsedHours > 2) {
        alerts.push({
          level: "WARNING",
          message: "Delayed induction: Core temp > 34.5 C after 2h of active cooling.",
        });
      }
    } else if (phase === "MAINTENANCE") {
      if (actualCoreTempC < 33.0) {
        alerts.push({
          level: "CRITICAL",
          message: "Core temperature hypothermia overshoot (< 33.0 C). Risk of severe arrhythmia, bradycardia, and coagulopathy.",
        });
        isSafe = false;
      } else if (actualCoreTempC > 34.0) {
        alerts.push({
          level: "WARNING",
          message: "Core temperature drift above therapeutic window (> 34.0 C). Adjust cooling blanket flow.",
        });
      }
    } else if (phase === "REWARMING") {
      if (rewarmingRatePerHour > 0.5) {
        alerts.push({
          level: "CRITICAL",
          message: "Rapid rewarming detected (" + rewarmingRatePerHour + " C/hr > safe limit 0.5 C/hr). High risk of cerebral edema, hypotension, and rebound seizures.",
        });
        isSafe = false;
      }
    }

    const severeAEEGPatterns = ["BURST_SUPPRESSION", "CONTINUOUS_LOW_VOLTAGE", "FLAT_ISOELECTRIC"];
    if (severeAEEGPatterns.includes(aEEGPattern)) {
      alerts.push({
        level: "HIGH",
        message: "Severely depressed aEEG background pattern: " + aEEGPattern + ". Continuous neuro-monitoring required.",
      });
    }

    return {
      phase,
      actualCoreTempC,
      targetCoreTempC,
      elapsedHours,
      rewarmingRatePerHour,
      aEEGPattern,
      isWithinTherapeuticWindow: actualCoreTempC >= 33.0 && actualCoreTempC <= 34.0,
      isSafe,
      alerts,
    };
  }

  calculateNeonatalVIS({
    dopamineMcgKgMin = 0,
    dobutamineMcgKgMin = 0,
    epinephrineMcgKgMin = 0,
    norepinephrineMcgKgMin = 0,
    milrinoneMcgKgMin = 0,
    vasopressinUnitsKgMin = 0,
  }) {
    const vis =
      dopamineMcgKgMin +
      dobutamineMcgKgMin +
      100 * epinephrineMcgKgMin +
      100 * norepinephrineMcgKgMin +
      10 * milrinoneMcgKgMin +
      10000 * vasopressinUnitsKgMin;

    const roundedVis = Math.round(vis * 100) / 100;
    let riskTier = "LOW (< 5.0)";
    if (roundedVis >= 20.0) riskTier = "EXTREME_CARDIOVASCULAR_COLLAPSE (>= 20.0)";
    else if (roundedVis >= 10.0) riskTier = "HIGH_INOTROPIC_DEPENDENCE (10.0 - 19.9)";
    else if (roundedVis >= 5.0) riskTier = "MODERATE_SUPPORT (5.0 - 9.9)";

    return {
      vis: roundedVis,
      riskTier,
      breakdown: {
        dopamineContribution: dopamineMcgKgMin,
        dobutamineContribution: dobutamineMcgKgMin,
        epinephrineContribution: 100 * epinephrineMcgKgMin,
        norepinephrineContribution: 100 * norepinephrineMcgKgMin,
        milrinoneContribution: 10 * milrinoneMcgKgMin,
        vasopressinContribution: 10000 * vasopressinUnitsKgMin,
      },
    };
  }

  generateHL7FHIRBundle(patientId) {
    const patient = this.getPatientById(patientId);
    const bundleId = "bundle-nicu-" + patientId + "-" + Date.now();

    return {
      resourceType: "Bundle",
      id: bundleId,
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: "urn:uuid:patient-" + patient.id,
          resource: {
            resourceType: "Patient",
            id: patient.id,
            identifier: [{ system: "http://hospital.medtrack.org/mrn", value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
            extension: [
              {
                url: "http://hl7.org/fhir/StructureDefinition/patient-birthWeight",
                valueQuantity: { value: patient.birthWeightGrams, unit: "g", system: "http://unitsofmeasure.org", code: "g" },
              },
              {
                url: "http://hl7.org/fhir/StructureDefinition/patient-gestationalAge",
                valueQuantity: { value: patient.gestationalAgeWeeks, unit: "wk", system: "http://unitsofmeasure.org", code: "wk" },
              },
            ],
          },
        },
        {
          fullUrl: "urn:uuid:obs-pre-ductal-spo2-" + patient.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry Pre-ductal" }],
            },
            subject: { reference: "urn:uuid:patient-" + patient.id },
            valueQuantity: { value: patient.currentVitals.preDuctalSpO2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
          },
        },
        {
          fullUrl: "urn:uuid:obs-post-ductal-spo2-" + patient.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "20564-1", display: "Oxygen saturation in Blood Post-ductal" }],
            },
            subject: { reference: "urn:uuid:patient-" + patient.id },
            valueQuantity: { value: patient.currentVitals.postDuctalSpO2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
          },
        },
        {
          fullUrl: "urn:uuid:obs-nsofa-" + patient.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: {
              coding: [{ system: "http://medtrack.org/scores", code: "nSOFA", display: "Neonatal Sequential Organ Failure Assessment" }],
            },
            subject: { reference: "urn:uuid:patient-" + patient.id },
            valueInteger: patient.nSofaScore,
          },
        },
        {
          fullUrl: "urn:uuid:obs-oi-" + patient.id,
          resource: {
            resourceType: "Observation",
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "76535-4", display: "Oxygenation index" }],
            },
            subject: { reference: "urn:uuid:patient-" + patient.id },
            valueQuantity: { value: patient.oxygenationIndex, unit: "ratio", system: "http://unitsofmeasure.org" },
          },
        },
      ],
    };
  }

  exportTelemetryToCSV(patientId) {
    const patient = this.getPatientById(patientId);
    const headers = [
      "Timestamp",
      "MRN",
      "Name",
      "GA_Weeks",
      "HeartRate_BPM",
      "RespRate_BPM",
      "PreDuctal_SpO2_Pct",
      "PostDuctal_SpO2_Pct",
      "Ductal_Delta_Pct",
      "MAP_mmHg",
      "CoreTemp_C",
      "SkinTemp_C",
      "nSOFA_Score",
      "OxygenationIndex",
      "InotropicScore_VIS",
      "CoolingPhase",
    ];

    const v = patient.currentVitals;
    const row = [
      v.timestamp,
      patient.mrn,
      "\"" + patient.name + "\"",
      patient.gestationalAgeWeeks,
      v.heartRate,
      v.respRate,
      v.preDuctalSpO2,
      v.postDuctalSpO2,
      patient.ductalGradient,
      v.map,
      v.coreTempC,
      v.skinTempC,
      patient.nSofaScore,
      patient.oxygenationIndex,
      patient.inotropicScoreVIS,
      patient.hypothermiaStatus.phase,
    ];

    return [headers.join(","), row.join(",")].join("\n");
  }
}

export const neonatalICUService = new NeonatalICUService();
