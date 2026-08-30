package com.medtrack.neurocritical.service;

import com.medtrack.neurocritical.dto.NeuromonitoringAssessmentRequest;
import com.medtrack.neurocritical.dto.NeuromonitoringAssessmentResponse;
import com.medtrack.neurocritical.dto.SibiccEscalationStatus;
import com.medtrack.neurocritical.model.NeuromonitoringTelemetryReading;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Enterprise Neurocritical Care & Multimodal Neuromonitoring (MMN) Service.
 *
 * Implements clinical algorithms for:
 * - Cerebral Perfusion Pressure (CPP = MAP - ICP)
 * - Brain Trauma Foundation (BTF 4th Edition) ICP <= 22 mmHg & CPP 60 - 70 mmHg targets
 * - Pressure Reactivity Index (PRx) cerebrovascular autoregulation classification
 * - Seattle International Severe TBI Consensus Conference (SIBICC 2020) Tier 0-3 Escalation
 * - Brain Tissue Oxygenation (PbtO2 < 20 mmHg hypoxia threshold)
 * - Automated Quantitative Pupillometry (NPi < 3.0 sluggish / non-reactive sentry)
 * - Lundberg Waveform Pattern Recognition (A-wave plateau emergency triggers)
 */
public class NeurocriticalCareService {

    /**
     * Compute Cerebral Perfusion Pressure.
     * Formula: CPP = MAP - ICP
     */
    public double calculateCPP(double map, double icp) {
        return Math.round((map - icp) * 10.0) / 10.0;
    }

    /**
     * Comprehensive neurocritical multimodal assessment engine.
     */
    public NeuromonitoringAssessmentResponse evaluateNeuromonitoring(NeuromonitoringAssessmentRequest req) {
        NeuromonitoringAssessmentResponse res = new NeuromonitoringAssessmentResponse();
        res.setPatientId(req.getPatientId());
        res.setEvaluatedAt(Instant.now());

        List<String> alarms = new ArrayList<>();
        List<String> actions = new ArrayList<>();

        NeuromonitoringTelemetryReading t = req.getTelemetryReading();
        if (t == null) {
            throw new IllegalArgumentException("Missing telemetry reading in assessment request");
        }

        // 1. CPP & ICP Calculation
        double cpp = calculateCPP(t.getMeanArterialPressure(), t.getIntracranialPressure());
        res.setCalculatedCpp(cpp);

        if (cpp < 50.0) {
            res.setCppInterpretation("CRITICAL_CEREBRAL_ISCHEMIA (CPP < 50 mmHg)");
            alarms.add("CRITICAL: Severe cerebral hypoperfusion (CPP " + cpp + " mmHg < 50). Risk of secondary ischemic infarction.");
            actions.add("Titrate vasopressors (Norepinephrine) to target CPP 60 - 70 mmHg");
        } else if (cpp < 60.0) {
            res.setCppInterpretation("SUBOPTIMAL_HYPOPERFUSION (CPP 50 - 59 mmHg)");
        } else if (cpp > 85.0) {
            res.setCppInterpretation("HYPERPERFUSION_VASOGENIC_EDEMA_RISK (CPP > 85 mmHg)");
        } else {
            res.setCppInterpretation("OPTIMAL_CPP_TARGET (60 - 70 mmHg)");
        }

        // ICP Severity Tiering
        double icp = t.getIntracranialPressure();
        if (icp >= 25.0) {
            res.setIcpSeverityTier("CRITICAL_INTRACRANIAL_HYPERTENSION (>= 25 mmHg)");
            alarms.add("CRITICAL: Severe ICP elevation (" + icp + " mmHg >= 25). Immediate SIBICC Tier 2/3 intervention.");
        } else if (icp >= 20.0) {
            res.setIcpSeverityTier("ELEVATED_ICP_BORDERLINE (20 - 24 mmHg)");
            alarms.add("WARNING: ICP " + icp + " mmHg exceeds BTF safety threshold of 20 mmHg.");
        } else {
            res.setIcpSeverityTier("NORMAL_ICP (<= 20 mmHg)");
        }

        // Lundberg A Plateau Waves
        if ("LUNDBERG_A_PLATEAU".equalsIgnoreCase(t.getLundbergWaveType())) {
            alarms.add("EMERGENCY: Lundberg A-wave plateau detected. Sudden sustained ICP surge (50-100 mmHg). Impending transtentorial herniation.");
            actions.add("Emergency hyperosmolar bolus (3% Hypertonic Saline or Mannitol) + EVD CSF drainage");
        }

        // 2. Cerebrovascular Autoregulation (PRx)
        double prx = t.getPressureReactivityIndexPRx();
        if (prx > 0.3) {
            res.setAutoregulationState("IMPAIRED_PASSIVE_VASCULATURE (PRx " + prx + " > 0.3)");
            alarms.add("WARNING: Loss of cerebral autoregulation (PRx " + prx + "). ICP is passively dependent on systemic MAP.");
        } else if (prx > 0.2) {
            res.setAutoregulationState("BORDERLINE_AUTOREGULATION (PRx 0.2 - 0.3)");
        } else {
            res.setAutoregulationState("INTACT_AUTOREGULATION (PRx <= 0.2)");
        }
        res.setOptimalCppTarget(70.0);

        // 3. Brain Tissue Oxygenation (PbtO2)
        double pbtO2 = t.getBrainTissueOxygenPbtO2();
        if (pbtO2 < 15.0) {
            res.setBrainOxygenationStatus("CRITICAL_BRAIN_TISSUE_HYPOXIA (PbtO2 < 15 mmHg)");
            alarms.add("CRITICAL: Severe brain tissue hypoxia (PbtO2 " + pbtO2 + " mmHg < 15). Rapid metabolic crisis.");
            actions.add("Increase PaO2 target (FiO2 titration) and optimize MAP/CPP to enhance microvascular diffusion");
        } else if (pbtO2 < 20.0) {
            res.setBrainOxygenationStatus("BORDERLINE_TISSUE_HYPOXIA (PbtO2 15 - 19 mmHg)");
        } else {
            res.setBrainOxygenationStatus("NORMIC_BRAIN_OXYGENATION (PbtO2 >= 20 mmHg)");
        }

        // 4. Automated Quantitative Pupillometry (NPi)
        double npiLeft = t.getNpiLeftEye();
        double npiRight = t.getNpiRightEye();
        double npiDelta = Math.abs(npiLeft - npiRight);

        if (npiLeft < 3.0 || npiRight < 3.0 || npiDelta >= 0.7) {
            res.setPupillometryAlertStatus("ABNORMAL_NPI_HERNIATION_RISK");
            alarms.add("CRITICAL: Quantitative Pupillometry alert (Left NPi: " + npiLeft + ", Right NPi: " + npiRight + ", Delta: " + String.format("%.2f", npiDelta) + "). Brainstem uncal herniation warning.");
            actions.add("Immediate Stat Head CT and neurosurgical notification for decompressive craniectomy");
        } else {
            res.setPupillometryAlertStatus("NORMAL_PUPILLARY_REACTIVITY (NPi >= 3.0)");
        }

        // 5. SIBICC Tier Formulation & Hyperosmolar Dosing
        List<String> sibiccInterventions = new ArrayList<>();
        String currentTier = "TIER_0";
        if (icp >= 25.0 || pbtO2 < 15.0 || npiLeft < 3.0 || npiRight < 3.0) {
            currentTier = "TIER_2";
            sibiccInterventions.add("Hyperosmolar therapy (3% Hypertonic Saline bolus)");
            sibiccInterventions.add("Neuromuscular blockade trial with continuous train-of-four monitoring");
            sibiccInterventions.add("Mild hyperventilation (PaCO2 30-35 mmHg) under continuous PbtO2 monitoring");
        } else if (icp >= 20.0 || pbtO2 < 20.0) {
            currentTier = "TIER_1";
            sibiccInterventions.add("EVD CSF drainage (continuous or intermittent opening at 10-15 cmH2O)");
            sibiccInterventions.add("Analgesia and sedation optimization to prevent cough/strain ICP spikes");
        } else {
            currentTier = "TIER_0";
            sibiccInterventions.add("Head of Bed elevation 30 degrees with neutral neck alignment");
            sibiccInterventions.add("Maintain normothermia, normoglycemia, and PaCO2 35-40 mmHg");
        }

        double htsDoseMl = Math.round(req.getPatientWeightKg() * 3.0); // 3% HTS 3 mL/kg
        res.setHyperosmolarDosingRecommendation("3% Hypertonic Saline: " + (int)htsDoseMl + " mL IV bolus over 15 min (or Mannitol 20%: " + (int)req.getPatientWeightKg() + " g IV)");

        SibiccEscalationStatus sibicc = new SibiccEscalationStatus(
                currentTier,
                "SIBICC 2020 Protocol " + currentTier,
                icp >= 25.0 && pbtO2 < 15.0,
                sibiccInterventions,
                List.of("Avoid routine prophylactic hyperventilation (PaCO2 < 30 mmHg)", "Avoid hypothermia < 32°C without continuous rewarming control")
        );
        res.setSibiccStatus(sibicc);

        res.setActiveNeurologicalAlarms(alarms);
        res.setPrioritizedClinicalActions(actions);

        return res;
    }
}
