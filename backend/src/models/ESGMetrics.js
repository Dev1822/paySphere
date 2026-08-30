const mongoose = require('mongoose');

const ESGSnapshotSchema = new mongoose.Schema({
    facilityId: { type: String, required: true, index: true },
    region: { type: String, required: true, index: true },
    reportMonth: { type: Date, required: true },

    // Environmental Metrics (Scope 1, 2, 3 CO2e tons)
    scope1Emissions: { type: Number, default: 0 },
    scope2Emissions: { type: Number, default: 0 },
    scope3Emissions: { type: Number, default: 0 },
    renewableEnergyPercentage: { type: Number, default: 0 },
    waterConsumptionGals: { type: Number, default: 0 },
    wasteDivertedPercentage: { type: Number, default: 0 },

    // Social Metrics 
    communityInvestmentScore: { type: Number, default: 0 },
    fairLaborIndex: { type: Number, default: 0 },
    healthSafetyIncidents: { type: Number, default: 0 },

    // Governance Metrics 
    boardDiversityPercentage: { type: Number, default: 0 },
    antiCorruptionTrainings: { type: Number, default: 0 },
    dataPrivacyBreaches: { type: Number, default: 0 },

    // Compliance Risk
    overallESGRiskRating: { type: Number, default: 0 },
    projectedFinesUSD: { type: Number, default: 0 }
}, { timestamps: true });

ESGSnapshotSchema.index({ region: 1, reportMonth: -1 });

module.exports = {
    ESGSnapshot: mongoose.model('ESGSnapshot', ESGSnapshotSchema)
};
