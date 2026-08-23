/**
 * Burn Critical Care & Resuscitation Fluid Dynamics Clinical Decision Support Models.
 *
 * Implements American Burn Association (ABA) 2026 Guidelines for Burn Resuscitation,
 * Parkland & Modified Brooke Formulas, Lund-Browder Total Body Surface Area (TBSA)
 * distribution, Intra-Abdominal Hypertension (IAH/ACS) monitoring, and Inhalation Injury grading.
 */

export const BURN_SEVERITY_LEVELS = Object.freeze({
  CRITICAL_MAJOR_BURN: {
    id: 'CRITICAL_MAJOR_BURN',
    label: 'Critical Major Burn (TBSA >= 40% / Inhalation Injury)',
    color: 'rose',
    priority: 1,
    description: 'Extensive full/partial-thickness burns requiring aggressive monitored crystalloid resuscitation and airway protection.',
  },
  MODERATE_BURN: {
    id: 'MODERATE_BURN',
    label: 'Moderate Thermal Injury (TBSA 20 - 39%)',
    color: 'orange',
    priority: 2,
    description: 'Systemic capillary leak requiring formula-based fluid resuscitation and serial urine output titration.',
  },
  ELECTRICAL_HIGH_VOLTAGE: {
    id: 'ELECTRICAL_HIGH_VOLTAGE',
    label: 'High-Voltage Electrical Injury & Rhabdomyolysis',
    color: 'purple',
    priority: 1,
    description: 'Deep tissue thermal necrosis, severe myoglobinuria, and compartment syndrome risk requiring higher urine targets.',
  },
  INHALATION_INJURY: {
    id: 'INHALATION_INJURY',
    label: 'Severe Inhalation Injury with Airway Compromise',
    color: 'cyan',
    priority: 1,
    description: 'Subglottic smoke and thermal injury with elevated Carboxyhemoglobin and acute respiratory distress.',
  },
});

export const RESUSCITATION_FORMULAS = Object.freeze({
  PARKLAND: {
    id: 'PARKLAND',
    name: 'Parkland (Baxter) Formula',
    multiplier: 4.0, // 4 mL / kg / % TBSA
    fluidType: 'Lactated Ringers or Balanced Crystalloid (Plasma-Lyte)',
    distribution: '50% in first 8 hours (from time of burn), 50% in remaining 16 hours',
    rationale: 'Standard consensus formula for adult thermal burns (ABA Practice Guidelines).',
  },
  MODIFIED_BROOKE: {
    id: 'MODIFIED_BROOKE',
    name: 'Modified Brooke Formula',
    multiplier: 2.0, // 2 mL / kg / % TBSA
    fluidType: 'Lactated Ringers',
    distribution: '50% in first 8 hours, 50% in remaining 16 hours',
    rationale: 'Preferred to minimize fluid creep, abdominal compartment syndrome, and pulmonary edema in elderly.',
  },
  GALVESTON_PEDIATRIC: {
    id: 'GALVESTON_PEDIATRIC',
    name: 'Galveston Pediatric Formula',
    multiplier: 5000, // 5000 mL/m2 BSA burned + 2000 mL/m2 maintenance
    fluidType: 'D5 LR with maintenance electrolyte support',
    distribution: '50% in first 8 hours, 50% in remaining 16 hours',
    rationale: 'Accounts for high body surface area-to-mass ratio and limited glycogen reserves in children.',
  },
});

export const LUND_BROWDER_REGIONS = Object.freeze([
  { id: 'HEAD_NECK', label: 'Head & Neck', adultPct: 9, infantPct: 18 },
  { id: 'ANTERIOR_TRUNK', label: 'Anterior Trunk (Chest & Abdomen)', adultPct: 18, infantPct: 18 },
  { id: 'POSTERIOR_TRUNK', label: 'Posterior Trunk (Back & Buttocks)', adultPct: 18, infantPct: 18 },
  { id: 'RIGHT_ARM', label: 'Right Upper Extremity', adultPct: 9, infantPct: 9 },
  { id: 'LEFT_ARM', label: 'Left Upper Extremity', adultPct: 9, infantPct: 9 },
  { id: 'RIGHT_LEG', label: 'Right Lower Extremity', adultPct: 18, infantPct: 14 },
  { id: 'LEFT_LEG', label: 'Left Lower Extremity', adultPct: 18, infantPct: 14 },
  { id: 'PERINEUM_GENITALIA', label: 'Perineum & Genitalia', adultPct: 1, infantPct: 1 },
]);

export const BURN_PATIENT_FIXTURES = Object.freeze([
  {
    id: 'BURN-PAT-501',
    mrn: 'BRN-209841',
    name: 'Captain Marcus Bennett',
    ageYears: 42,
    sex: 'Male',
    location: 'Burn ICU - Bed 01',
    mechanism: 'Industrial Flash Fire & Closed-Space Smoke Inhalation',
    tbsaPercent: 45, // 45% 2nd & 3rd degree
    weightKg: 80,
    timeSinceBurnHours: 4.5,
    severity: 'CRITICAL_MAJOR_BURN',
    resuscitationFormula: 'PARKLAND',
    calculated24hFluidMl: 14400, // 4 * 80 * 45
    first8hTargetMl: 7200,
    next16hTargetMl: 7200,
    fluidAdministeredMl: 4800,
    currentInfusionRateMlHr: 900,
    hourlyUrineOutputMl: 38,
    targetUoMinMlHr: 40, // 0.5 mL/kg/h
    targetUoMaxMlHr: 80, // 1.0 mL/kg/h
    map: 68,
    heartRate: 118,
    systolicBp: 98,
    diastolicBp: 54,
    tempC: 35.8, // Hypothermia risk
    spo2: 96,
    fio2: 0.50,
    pao2: 92,
    carboxyhemoglobinPercent: 12.4, // % COHb
    inhalationGrade: 'AIS_GRADE_3',
    intraAbdominalPressureMmHg: 16, // Bladder pressure (mmHg)
    lactate: 3.8,
    creatinine: 1.4,
    compartmentPressures: {
      rightForearm: 22,
      leftForearm: 18,
      rightThigh: 16,
      leftThigh: 15,
    },
    burnDistribution: [
      { region: 'Anterior Trunk', depth: 'Full Thickness (3rd Deg)', pct: 14 },
      { region: 'Posterior Trunk', depth: 'Deep Partial (2nd Deg)', pct: 12 },
      { region: 'Right Upper Extremity', depth: 'Full Thickness Circumferential', pct: 9 },
      { region: 'Left Upper Extremity', depth: 'Deep Partial', pct: 6 },
      { region: 'Head & Neck', depth: 'Partial Thickness', pct: 4 },
    ],
  },
  {
    id: 'BURN-PAT-502',
    mrn: 'BRN-774120',
    name: 'Helena Gutierrez',
    ageYears: 68,
    sex: 'Female',
    location: 'Burn ICU - Bed 03',
    mechanism: 'Domestic Natural Gas Explosion & Scald Injury',
    tbsaPercent: 55,
    weightKg: 65,
    timeSinceBurnHours: 7.0,
    severity: 'CRITICAL_MAJOR_BURN',
    resuscitationFormula: 'MODIFIED_BROOKE',
    calculated24hFluidMl: 7150, // 2 * 65 * 55
    first8hTargetMl: 3575,
    next16hTargetMl: 3575,
    fluidAdministeredMl: 3900,
    currentInfusionRateMlHr: 450,
    hourlyUrineOutputMl: 42,
    targetUoMinMlHr: 32.5,
    targetUoMaxMlHr: 65.0,
    map: 72,
    heartRate: 104,
    systolicBp: 108,
    diastolicBp: 58,
    tempC: 36.4,
    spo2: 94,
    fio2: 0.40,
    pao2: 86,
    carboxyhemoglobinPercent: 4.2,
    inhalationGrade: 'AIS_GRADE_1',
    intraAbdominalPressureMmHg: 19, // Fluid creep warning
    lactate: 2.9,
    creatinine: 1.8,
    compartmentPressures: {
      rightForearm: 14,
      leftForearm: 15,
      rightThigh: 20,
      leftThigh: 19,
    },
    burnDistribution: [
      { region: 'Anterior Trunk', depth: 'Full Thickness', pct: 16 },
      { region: 'Posterior Trunk', depth: 'Deep Partial', pct: 15 },
      { region: 'Right Lower Extremity', depth: 'Deep Partial', pct: 12 },
      { region: 'Left Lower Extremity', depth: 'Deep Partial', pct: 12 },
    ],
  },
  {
    id: 'BURN-PAT-503',
    mrn: 'BRN-902184',
    name: 'Lucas Campbell',
    ageYears: 29,
    sex: 'Male',
    location: 'Burn Trauma Bay 02',
    mechanism: '13.8 kV High-Voltage Electrical Contact',
    tbsaPercent: 28, // Surface deceptively smaller than deep tissue loss
    weightKg: 85,
    timeSinceBurnHours: 2.0,
    severity: 'ELECTRICAL_HIGH_VOLTAGE',
    resuscitationFormula: 'PARKLAND',
    calculated24hFluidMl: 9520, // 4 * 85 * 28
    first8hTargetMl: 4760,
    next16hTargetMl: 4760,
    fluidAdministeredMl: 2200,
    currentInfusionRateMlHr: 1100,
    hourlyUrineOutputMl: 115, // Higher target 1.0-1.5 mL/kg/h for myoglobinuria
    targetUoMinMlHr: 85,
    targetUoMaxMlHr: 130,
    map: 84,
    heartRate: 128,
    systolicBp: 122,
    diastolicBp: 68,
    tempC: 37.0,
    spo2: 98,
    fio2: 0.30,
    pao2: 104,
    carboxyhemoglobinPercent: 1.8,
    inhalationGrade: 'AIS_GRADE_0',
    intraAbdominalPressureMmHg: 12,
    lactate: 4.2,
    creatinine: 2.1,
    compartmentPressures: {
      rightForearm: 36, // Emergency Escharotomy / Fasciotomy Trigger (> 30 mmHg)
      leftForearm: 14,
      rightThigh: 24,
      leftThigh: 16,
    },
    burnDistribution: [
      { region: 'Right Upper Extremity (Entrance)', depth: 'Full Thickness / Charred', pct: 9 },
      { region: 'Right Lower Extremity (Exit)', depth: 'Full Thickness', pct: 11 },
      { region: 'Anterior Trunk', depth: 'Deep Partial', pct: 8 },
    ],
  },
]);
