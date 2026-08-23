/**
 * Cellular Immunotherapy CAR-T Toxicity Clinical Decision Support Models.
 *
 * Implements ASTCT (American Society for Transplantation and Cellular Therapy) 2026
 * Consensus Grading for Cytokine Release Syndrome (CRS) and Immune Effector
 * Cell-Associated Neurotoxicity Syndrome (ICANS), 10-point Immune Effector
 * Cell-Associated Encephalopathy (ICE) cognitive scoring, and cytokine biomarker cascades.
 */

export const ASTCT_CRS_GRADES = Object.freeze({
  GRADE_1: {
    grade: 1,
    title: 'Grade 1 CRS (Mild)',
    color: 'amber',
    fever: 'Temperature >= 38.0 deg C',
    hypotension: 'None',
    hypoxia: 'None (Room air)',
    clinicalAction: 'Supportive care, blood cultures, antipyretics (Acetaminophen), diagnostic cytokine panel.',
  },
  GRADE_2: {
    grade: 2,
    title: 'Grade 2 CRS (Moderate)',
    color: 'orange',
    fever: 'Temperature >= 38.0 deg C',
    hypotension: 'Responsive to IV fluids (crystalloid boluses) OR low-dose vasopressor',
    hypoxia: 'Requires low-flow nasal cannula (<= 40% FiO2 or <= 6 L/min O2)',
    clinicalAction: 'Initiate Tocilizumab 8 mg/kg IV (max 800mg) x 1 dose. Monitor ICU transfer threshold.',
  },
  GRADE_3: {
    grade: 3,
    title: 'Grade 3 CRS (Severe)',
    color: 'rose',
    fever: 'Temperature >= 38.0 deg C',
    hypotension: 'Requires single vasopressor (Norepinephrine) with or without vasopressin',
    hypoxia: 'Requires high-flow nasal cannula (> 6 L/min), face mask, or BiPAP / CPAP',
    clinicalAction: 'Immediate ICU admission, repeat Tocilizumab q8h (max 4 doses), start Dexamethasone 10-20mg IV q6h.',
  },
  GRADE_4: {
    grade: 4,
    title: 'Grade 4 CRS (Life-Threatening)',
    color: 'purple',
    fever: 'Temperature >= 38.0 deg C',
    hypotension: 'Requires multiple vasopressors (Norepinephrine + Epinephrine + Vasopressin)',
    hypoxia: 'Requires positive pressure mechanical ventilation / endotracheal intubation',
    clinicalAction: 'Emergent ICU resuscitation, Methylprednisolone 1000mg/day IV pulse, consider Anakinra 100-200mg IV q6h.',
  },
});

export const ASTCT_ICANS_GRADES = Object.freeze({
  GRADE_1: {
    grade: 1,
    title: 'Grade 1 ICANS (Mild)',
    color: 'amber',
    iceScore: '7 - 9 / 10',
    neurologicalFeatures: 'Mild expressive dysphasia, impaired handwriting, slowed mental processing.',
    action: 'Neurology consult, continuous EEG, avoid sedation, levetiracetam seizure prophylaxis.',
  },
  GRADE_2: {
    grade: 2,
    title: 'Grade 2 ICANS (Moderate)',
    color: 'orange',
    iceScore: '3 - 6 / 10',
    neurologicalFeatures: 'Moderate expressive aphasia, impaired comprehension, mild somnolence but easily aroused.',
    action: 'Dexamethasone 10mg IV q6h. Non-contrast head CT to rule out intracranial hemorrhage.',
  },
  GRADE_3: {
    grade: 3,
    title: 'Grade 3 ICANS (Severe)',
    color: 'rose',
    iceScore: '0 - 2 / 10',
    neurologicalFeatures: 'Severe global aphasia, stupor, focal motor weakness, or clinical seizures responsive to antiepileptics.',
    action: 'Transfer to Neuro-ICU. Dexamethasone 20mg IV q6h or Methylprednisolone 1000mg/day. Stat brain MRI.',
  },
  GRADE_4: {
    grade: 4,
    title: 'Grade 4 ICANS (Life-Threatening)',
    color: 'purple',
    iceScore: '0 / 10 (Patient unarousable or non-verbal)',
    neurologicalFeatures: 'Coma, status epilepticus, diffuse cerebral edema with midline shift, pupillary asymmetry.',
    action: 'Emergent airway protection/intubation, Hypertonic saline (3%) or Mannitol for cerebral edema, high-dose pulse steroids.',
  },
});

export const ICE_COGNITIVE_ASSESSMENT_ITEMS = Object.freeze([
  { id: 'ORIENTATION_YEAR', task: 'Orientation: What year is it?', points: 1 },
  { id: 'ORIENTATION_MONTH', task: 'Orientation: What month is it?', points: 1 },
  { id: 'ORIENTATION_CITY', task: 'Orientation: What city are we in?', points: 1 },
  { id: 'ORIENTATION_HOSPITAL', task: 'Orientation: What hospital are we in?', points: 1 },
  { id: 'NAMING_OBJECT_1', task: 'Naming: Name object 1 (e.g., Pen / Stethoscope)', points: 1 },
  { id: 'NAMING_OBJECT_2', task: 'Naming: Name object 2 (e.g., Watch / Clock)', points: 1 },
  { id: 'NAMING_OBJECT_3', task: 'Naming: Name object 3 (e.g., Tie / Badge)', points: 1 },
  { id: 'FOLLOW_COMMAND', task: 'Following Commands: "Show me 2 fingers with your left hand"', points: 1 },
  { id: 'WRITING_SENTENCE', task: 'Writing: Write a standard complete sentence on paper', points: 1 },
  { id: 'ATTENTION_COUNTING', task: 'Attention: Count backwards from 100 by 10s (100, 90, 80, 70...)', points: 1 },
]);

export const CART_PATIENT_FIXTURES = Object.freeze([
  {
    id: 'CART-PAT-401',
    mrn: 'IMM-809214',
    name: 'Julian Montgomery',
    ageYears: 58,
    sex: 'Male',
    location: 'Cellular Therapy ICU - Bed 02',
    carTConstruct: 'Axicabtagene Ciloleucel (Yescarta - Anti-CD19)',
    infusionDay: '+5 Days Post-Infusion',
    indication: 'Relapsed/Refractory Diffuse Large B-Cell Lymphoma (DLBCL)',
    crsGrade: 3,
    icansGrade: 2,
    iceScore: 5,
    tempC: 39.6,
    heartRate: 124,
    systolicBp: 88,
    diastolicBp: 52,
    map: 64.0,
    spo2: 92,
    oxygenDelivery: 'High-Flow Nasal Cannula (12 L/min, FiO2 0.50)',
    respRate: 26,
    vasopressor: {
      primary: 'Norepinephrine',
      rateMcgKgMin: 0.14,
      status: 'Escalating single vasopressor for vasodilatory shock',
    },
    neurologicalExam: 'Moderate expressive dysphasia, ICE 5/10, unable to count backwards, motor strength 4/5 bilaterally.',
    biomarkers: {
      il6: 842.0, // pg/mL (Norm < 7.0)
      ferritin: 14200, // ng/mL (Norm < 400)
      crp: 218.4, // mg/L (Norm < 5.0)
      dDimer: 8.9, // mcg/mL
      ldh: 940, // U/L
      ifnGamma: 320.0, // pg/mL
    },
    immunomodulatorsGiven: [
      { drug: 'Tocilizumab', dose: '800mg IV', timeAgo: '4 hours ago', cumulativeDoses: 2 },
      { drug: 'Dexamethasone', dose: '20mg IV', timeAgo: '2 hours ago', cumulativeDoses: 1 },
      { drug: 'Levetiracetam', dose: '750mg IV q12h', timeAgo: 'Continuous Prophylaxis', cumulativeDoses: 6 },
    ],
  },
  {
    id: 'CART-PAT-402',
    mrn: 'IMM-674190',
    name: 'Seraphina Lin',
    ageYears: 24,
    sex: 'Female',
    location: 'BMT Unit - Room 412 (Step-down)',
    carTConstruct: 'Tisagenlecleucel (Kymriah - Anti-CD19)',
    infusionDay: '+3 Days Post-Infusion',
    indication: 'Relapsed B-Cell Acute Lymphoblastic Leukemia (B-ALL)',
    crsGrade: 2,
    icansGrade: 1,
    iceScore: 8,
    tempC: 38.9,
    heartRate: 108,
    systolicBp: 98,
    diastolicBp: 60,
    map: 72.7,
    spo2: 95,
    oxygenDelivery: 'Low-Flow Nasal Cannula (2 L/min O2)',
    respRate: 20,
    vasopressor: {
      primary: 'None',
      rateMcgKgMin: 0.0,
      status: 'Hemodynamically stable following 1000 mL crystalloid bolus',
    },
    neurologicalExam: 'Mild tremor in dominant hand, subtle handwriting degradation, ICE 8/10, oriented x 4.',
    biomarkers: {
      il6: 310.0,
      ferritin: 4800,
      crp: 96.5,
      dDimer: 3.2,
      ldh: 460,
      ifnGamma: 110.0,
    },
    immunomodulatorsGiven: [
      { drug: 'Tocilizumab', dose: '600mg IV', timeAgo: '6 hours ago', cumulativeDoses: 1 },
      { drug: 'Levetiracetam', dose: '500mg PO q12h', timeAgo: 'Continuous Prophylaxis', cumulativeDoses: 4 },
    ],
  },
  {
    id: 'CART-PAT-403',
    mrn: 'IMM-932105',
    name: 'Arthur Sterling',
    ageYears: 67,
    sex: 'Male',
    location: 'Neuro-ICU - Bed 06',
    carTConstruct: 'Ciltacabtagene Autoleucel (Carvykti - Anti-BCMA)',
    infusionDay: '+8 Days Post-Infusion',
    indication: 'Triple-Class Refractory Multiple Myeloma',
    crsGrade: 1,
    icansGrade: 3,
    iceScore: 2,
    tempC: 38.2,
    heartRate: 92,
    systolicBp: 126,
    diastolicBp: 76,
    map: 92.7,
    spo2: 97,
    oxygenDelivery: 'Room Air (21% FiO2)',
    respRate: 18,
    vasopressor: {
      primary: 'None',
      rateMcgKgMin: 0.0,
      status: 'Normotensive without vasopressor support',
    },
    neurologicalExam: 'Severe expressive global aphasia, stupor with intermittent myoclonic twitches, ICE 2/10.',
    biomarkers: {
      il6: 85.0,
      ferritin: 8900,
      crp: 48.0,
      dDimer: 5.4,
      ldh: 620,
      ifnGamma: 45.0,
    },
    immunomodulatorsGiven: [
      { drug: 'Dexamethasone', dose: '20mg IV q6h', timeAgo: '1 hour ago', cumulativeDoses: 3 },
      { drug: 'Anakinra', dose: '100mg SubQ', timeAgo: 'Under evaluation for steroid-refractory ICANS', cumulativeDoses: 0 },
      { drug: 'Levetiracetam', dose: '1000mg IV q12h', timeAgo: 'Prophylaxis', cumulativeDoses: 8 },
    ],
  },
]);
