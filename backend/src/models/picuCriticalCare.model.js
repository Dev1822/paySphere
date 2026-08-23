/**
 * Pediatric Intensive Care Unit (PICU) Multi-Organ Dysfunction & pSOFA Clinical Decision Support Models.
 *
 * Implements Pediatric Sequential Organ Failure Assessment (pSOFA) adjusted for age-specific norms,
 * Vasoactive-Inotropic Score (VIS) for pediatric septic/cardiogenic shock, and
 * PALICC (Pediatric Acute Lung Injury Consensus Conference) Oxygenation Index (OI) analytics.
 */

export const PEDIATRIC_AGE_GROUPS = Object.freeze({
  NEONATE: { id: 'NEONATE', label: 'Neonate (< 1 month)', ageMonthsMin: 0, ageMonthsMax: 0.99 },
  INFANT: { id: 'INFANT', label: 'Infant (1 - 11 months)', ageMonthsMin: 1, ageMonthsMax: 11.99 },
  TODDLER: { id: 'TODDLER', label: 'Toddler (12 - 23 months)', ageMonthsMin: 12, ageMonthsMax: 23.99 },
  PRESCHOOL: { id: 'PRESCHOOL', label: 'Child (24 - 59 months)', ageMonthsMin: 24, ageMonthsMax: 59.99 },
  SCHOOL_AGE: { id: 'SCHOOL_AGE', label: 'School Age (5 - 11 years)', ageMonthsMin: 60, ageMonthsMax: 143.99 },
  ADOLESCENT: { id: 'ADOLESCENT', label: 'Adolescent (12 - 17 years)', ageMonthsMin: 144, ageMonthsMax: 215.99 },
});

export const VIS_RISK_THRESHOLDS = Object.freeze({
  LOW_INOTROPIC_SUPPORT: { maxVis: 10, label: 'Low Inotropic Requirement (VIS < 10)', color: 'emerald' },
  MODERATE_SUPPORT: { maxVis: 20, label: 'Moderate Vasoactive Need (VIS 10 - 20)', color: 'amber' },
  HIGH_RISK_SHOCK: { maxVis: 30, label: 'Severe Pediatric Shock (VIS 21 - 30)', color: 'orange' },
  EXTREME_VASOPLEGIA: { maxVis: Infinity, label: 'Extreme Vasoplegia / Myocardial Dysfunction (VIS > 30)', color: 'rose' },
});

export const PICU_PATIENT_FIXTURES = Object.freeze([
  {
    id: 'PICU-PAT-701',
    mrn: 'PED-551094',
    name: 'Noah Sterling-Hayes',
    ageMonths: 48, // 4 years
    ageGroup: 'PRESCHOOL',
    sex: 'Male',
    location: 'PICU Bay 01 (Isolation)',
    diagnosis: 'Fulminant Meningococcemia, Purpura Fulminans & Refractory Septic Shock',
    psofaScore: 14,
    psofaMax: 24,
    mortalityRiskEstimated: '48.2%',
    visScore: 35.0,
    oxygenationIndex: 16.8, // Moderate-Severe PARDS
    vitals: {
      heartRate: 164, // Tachycardia for 4yo
      systolicBp: 72,
      diastolicBp: 38,
      map: 49.3,
      respRate: 36,
      tempC: 39.4,
      spo2: 91,
    },
    ventilator: {
      mode: 'PRVC / Lung Protective',
      meanAirwayPressure: 14,
      fio2: 0.70,
      pao2: 58,
      peep: 10,
      tidalVolumeMlKg: 5.8,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.15,
      norepinephrineMcgKgMin: 0.10,
      milrinoneMcgKgMin: 0.50,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0005,
    },
    labs: {
      plateletsKUl: 32, // Thrombocytopenia (< 50)
      totalBilirubinMgDl: 3.8,
      serumCreatinineMgDl: 1.8, // Normal for 4yo is 0.3 - 0.5
      lactateMmolL: 5.4,
      pediatricGcs: 8, // Stuporous
    },
    organSystemFailures: [
      { system: 'Cardiovascular', score: 4, detail: 'VIS 35.0 (Epinephrine 0.15 + NE 0.10 + Milrinone)' },
      { system: 'Respiratory', score: 3, detail: 'PaO2/FiO2 82.8 (OI 16.8, PARDS)' },
      { system: 'Coagulation', score: 3, detail: 'Platelets 32,000 /mcL (DIC & Purpura)' },
      { system: 'Renal', score: 2, detail: 'Creatinine 1.8 mg/dL (4x baseline for age)' },
      { system: 'Neurological', score: 2, detail: 'Pediatric GCS 8 / 15' },
    ],
  },
  {
    id: 'PICU-PAT-702',
    mrn: 'PED-209144',
    name: 'Maya Sophia Chen',
    ageMonths: 8, // 8 months
    ageGroup: 'INFANT',
    sex: 'Female',
    location: 'PICU Bed 04',
    diagnosis: 'Severe RSV Bronchiolitis, Secondary Bacterial Pneumonia & PARDS',
    psofaScore: 8,
    psofaMax: 24,
    mortalityRiskEstimated: '14.5%',
    visScore: 12.0,
    oxygenationIndex: 11.4,
    vitals: {
      heartRate: 142,
      systolicBp: 78,
      diastolicBp: 44,
      map: 55.3,
      respRate: 48,
      tempC: 38.6,
      spo2: 94,
    },
    ventilator: {
      mode: 'HFOV / High-Frequency Oscillatory',
      meanAirwayPressure: 18,
      fio2: 0.55,
      pao2: 87,
      peep: 8,
      tidalVolumeMlKg: 5.2,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.05,
      norepinephrineMcgKgMin: 0.0,
      milrinoneMcgKgMin: 0.35,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0,
    },
    labs: {
      plateletsKUl: 145,
      totalBilirubinMgDl: 0.8,
      serumCreatinineMgDl: 0.6,
      lactateMmolL: 2.1,
      pediatricGcs: 13,
    },
    organSystemFailures: [
      { system: 'Respiratory', score: 3, detail: 'HFOV support, OI 11.4 (Moderate PARDS)' },
      { system: 'Cardiovascular', score: 2, detail: 'Milrinone + Low-dose Epinephrine (VIS 12.0)' },
      { system: 'Renal', score: 1, detail: 'Creatinine 0.6 mg/dL' },
      { system: 'Neurological', score: 1, detail: 'pGCS 13 (Sedated on Dexmedetomidine)' },
    ],
  },
  {
    id: 'PICU-PAT-703',
    mrn: 'PED-781920',
    name: 'Ethan James Brooks',
    ageMonths: 168, // 14 years
    ageGroup: 'ADOLESCENT',
    sex: 'Male',
    location: 'PICU Trauma Bay',
    diagnosis: 'Pediatric Polytrauma, Pulmonary Contusions & Rhabdomyolysis',
    psofaScore: 5,
    psofaMax: 24,
    mortalityRiskEstimated: '6.2%',
    visScore: 5.0,
    oxygenationIndex: 4.8,
    vitals: {
      heartRate: 98,
      systolicBp: 112,
      diastolicBp: 64,
      map: 80.0,
      respRate: 20,
      tempC: 37.2,
      spo2: 97,
    },
    ventilator: {
      mode: 'SIMV-PS',
      meanAirwayPressure: 8,
      fio2: 0.35,
      pao2: 95,
      peep: 5,
      tidalVolumeMlKg: 7.0,
    },
    inotropes: {
      epinephrineMcgKgMin: 0.0,
      norepinephrineMcgKgMin: 0.05,
      milrinoneMcgKgMin: 0.0,
      dopamineMcgKgMin: 0.0,
      vasopressinUnitsKgMin: 0.0,
    },
    labs: {
      plateletsKUl: 210,
      totalBilirubinMgDl: 1.1,
      serumCreatinineMgDl: 1.4,
      lactateMmolL: 1.8,
      pediatricGcs: 14,
    },
    organSystemFailures: [
      { system: 'Renal', score: 2, detail: 'Creatinine 1.4 mg/dL (Rhabdomyolysis-induced AKI)' },
      { system: 'Cardiovascular', score: 1, detail: 'Norepinephrine 0.05 mcg/kg/min (VIS 5.0)' },
      { system: 'Respiratory', score: 1, detail: 'PaO2/FiO2 271' },
      { system: 'Neurological', score: 1, detail: 'pGCS 14' },
    ],
  },
]);
